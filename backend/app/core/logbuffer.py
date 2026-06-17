"""In-memory ring buffer of recent log records for the admin panel.

A logging handler keeps the last N records in a deque; the admin "Logs" section
reads them. Frontend error reports are pushed in via `push_external` so they
show up in the same stream tagged FRONTEND.
"""
from __future__ import annotations

import logging
import time
from collections import deque
from threading import Lock

_backend: deque[dict] = deque(maxlen=600)
_frontend: deque[dict] = deque(maxlen=200)  # separate so it can't evict backend logs
_lock = Lock()


class RingBufferHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        try:
            entry = {
                "ts": record.created,
                "level": record.levelname,
                "source": record.name,
                "message": record.getMessage(),
            }
            if record.exc_info:
                entry["message"] += "\n" + self.format(record)
        except Exception:  # noqa: BLE001 - logging must never raise
            return
        with _lock:
            _backend.append(entry)


def install(level: int = logging.INFO) -> None:
    """Attach the ring buffer to the root logger (idempotent)."""
    root = logging.getLogger()
    if any(isinstance(h, RingBufferHandler) for h in root.handlers):
        return
    handler = RingBufferHandler(level=level)
    handler.setFormatter(logging.Formatter("%(message)s"))
    root.addHandler(handler)


def push_external(level: str, source: str, message: str) -> None:
    """Record a log line from outside Python's logging (e.g. the frontend)."""
    with _lock:
        _frontend.append(
            {"ts": time.time(), "level": level.upper(), "source": source or "frontend", "message": message[:2000]}
        )


def recent_logs(limit: int = 300, level: str | None = None, scope: str = "backend") -> list[dict]:
    """scope: 'backend' | 'frontend' | 'all'. Newest first."""
    with _lock:
        if scope == "frontend":
            items = list(_frontend)
        elif scope == "all":
            items = sorted([*_backend, *_frontend], key=lambda e: e["ts"])
        else:
            items = list(_backend)
    if level and level.upper() != "ALL":
        want = level.upper()
        items = [e for e in items if e["level"] == want]
    return items[-limit:][::-1]
