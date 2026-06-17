"""Live system stats for the admin panel (the backend container's own usage).

Memory is read cgroup-first so it reflects the HF container limit (e.g. ~16 GB)
rather than the host's total. psutil is imported lazily so the app still boots
if it isn't installed.
"""
from __future__ import annotations

import time
from pathlib import Path

from app.config import settings

_proc_start = time.time()


def _read_int(path: str) -> int | None:
    try:
        v = Path(path).read_text().strip()
        return None if v in ("", "max") else int(v)
    except (OSError, ValueError):
        return None


def _container_memory() -> tuple[int | None, int | None]:
    """(used, total) bytes — cgroup v2, then v1, then None."""
    # cgroup v2
    total = _read_int("/sys/fs/cgroup/memory.max")
    used = _read_int("/sys/fs/cgroup/memory.current")
    if used is not None:
        return used, total
    # cgroup v1
    total = _read_int("/sys/fs/cgroup/memory/memory.limit_in_bytes")
    used = _read_int("/sys/fs/cgroup/memory/memory.usage_in_bytes")
    if used is not None:
        # v1 reports a huge sentinel when unlimited.
        if total and total > (1 << 60):
            total = None
        return used, total
    return None, None


def system_stats() -> dict:
    try:
        import psutil
    except Exception:  # noqa: BLE001
        return {"available": False, "uptime_seconds": int(time.time() - _proc_start)}

    proc = psutil.Process()
    used, total = _container_memory()
    if used is None:  # fall back to host memory
        vm = psutil.virtual_memory()
        used, total = vm.used, vm.total

    try:
        disk = psutil.disk_usage(str(settings.storage_path))
        disk_used, disk_total, disk_pct = disk.used, disk.total, disk.percent
    except Exception:  # noqa: BLE001
        disk_used = disk_total = disk_pct = None

    mem_pct = round(used / total * 100, 1) if (used and total) else None
    return {
        "available": True,
        "cpu_percent": psutil.cpu_percent(interval=0.2),
        "cpu_count": psutil.cpu_count(),
        "load_avg": list(psutil.getloadavg()) if hasattr(psutil, "getloadavg") else None,
        "memory_used": used,
        "memory_total": total,
        "memory_percent": mem_pct,
        "disk_used": disk_used,
        "disk_total": disk_total,
        "disk_percent": disk_pct,
        "process_memory": proc.memory_info().rss,
        "uptime_seconds": int(time.time() - proc.create_time()),
        "threads": proc.num_threads(),
    }
