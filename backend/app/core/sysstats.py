"""Live stats for the backend's *own* container (HF Space).

Reads Linux cgroup v2 directly so CPU/RAM reflect the container's limits and
usage — not the shared host that psutil would report. Falls back to psutil
(and then to nothing) off Linux / outside a cgroup.
"""
from __future__ import annotations

import time
from pathlib import Path

from app.config import settings

_proc_start = time.time()
_CG = Path("/sys/fs/cgroup")


def _read_int(path: Path) -> int | None:
    try:
        v = path.read_text().strip()
        return None if v in ("", "max") else int(v)
    except (OSError, ValueError):
        return None


def _cg_field(path: Path, key: str) -> int | None:
    try:
        for line in path.read_text().splitlines():
            if line.startswith(key + " "):
                return int(line.split()[1])
    except OSError:
        return None
    return None


def _cgroup_cpu_allocated() -> float | None:
    """Allocated cores from cpu.max ('quota period'), or None if unlimited."""
    try:
        parts = (_CG / "cpu.max").read_text().split()
        if len(parts) == 2 and parts[0] != "max" and int(parts[1]):
            return int(parts[0]) / int(parts[1])
    except (OSError, ValueError):
        pass
    return None


def _cgroup_cpu_percent(interval: float = 0.25) -> float | None:
    """Container CPU% = cores used / cores allocated, sampled over `interval`."""
    stat = _CG / "cpu.stat"
    u0 = _cg_field(stat, "usage_usec")
    if u0 is None:
        return None
    time.sleep(interval)
    u1 = _cg_field(stat, "usage_usec")
    if u1 is None:
        return None
    cores_used = (u1 - u0) / (interval * 1_000_000)
    allocated = _cgroup_cpu_allocated()
    if not allocated:
        try:
            import psutil

            allocated = psutil.cpu_count() or 1
        except Exception:  # noqa: BLE001
            allocated = 1
    return round(min(100.0, cores_used / allocated * 100), 1)


def _cgroup_memory() -> tuple[int | None, int | None]:
    """(working-set used, limit) bytes — current minus file cache."""
    cur = _read_int(_CG / "memory.current")
    if cur is None:
        return None, None
    total = _read_int(_CG / "memory.max")
    inactive = _cg_field(_CG / "memory.stat", "inactive_file") or 0
    return max(0, cur - inactive), total


def system_stats() -> dict:
    cpu_pct = _cgroup_cpu_percent()
    used, total = _cgroup_memory()
    cpu_count = None
    proc_rss = None
    uptime = int(time.time() - _proc_start)
    threads = None
    disk_used = disk_total = disk_pct = None

    try:
        import psutil

        cpu_count = psutil.cpu_count()
        p = psutil.Process()
        proc_rss = p.memory_info().rss
        uptime = int(time.time() - p.create_time())
        threads = p.num_threads()
        if cpu_pct is None:
            cpu_pct = psutil.cpu_percent(interval=0.2)
        if used is None:
            vm = psutil.virtual_memory()
            used, total = vm.used, vm.total
        try:
            d = psutil.disk_usage(str(settings.storage_path))
            disk_used, disk_total, disk_pct = d.used, d.total, d.percent
        except Exception:  # noqa: BLE001
            pass
    except Exception:  # noqa: BLE001 - psutil optional
        if cpu_pct is None and used is None:
            return {"available": False, "uptime_seconds": uptime}

    mem_pct = round(used / total * 100, 1) if (used and total) else None
    return {
        "available": True,
        "cpu_percent": cpu_pct,
        "cpu_count": cpu_count,
        "memory_used": used,
        "memory_total": total,
        "memory_percent": mem_pct,
        "disk_used": disk_used,
        "disk_total": disk_total,
        "disk_percent": disk_pct,
        "process_memory": proc_rss,
        "uptime_seconds": uptime,
        "threads": threads,
    }
