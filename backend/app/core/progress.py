"""Live job-progress registry + a ContextVar reporter.

Long jobs (video/audio transcode, speech-to-text) report a real percentage as
they run. The client passes an `X-Job-Id` header on the processing POST and, in
parallel, opens an SSE stream at `/api/jobs/{id}/progress` to watch it — so the
UI shows a real bar instead of an indeterminate spinner.

Design notes:
- The registry is a small in-memory dict guarded by a lock (per-instance, which
  is correct for the single-container deployment; use Redis for multi-instance).
- Services never see a job id. They call `progress.report(pct)`; the active
  reporter is held in a ContextVar that `run_job` binds before handing the
  synchronous work to the threadpool (anyio copies the context into the thread).
  When nothing is bound, `report()` is a no-op — so services stay decoupled.
"""
from __future__ import annotations

import contextvars
import threading
import time
from typing import Callable

# job_id -> {"percent": float, "stage": str, "done": bool, "ts": float}
_registry: dict[str, dict] = {}
_lock = threading.Lock()

# Drop finished jobs this many seconds after completion (lazy GC on access).
_TTL_DONE = 120.0
_MAX_ENTRIES = 1000


def _gc_locked() -> None:
    now = time.monotonic()
    if len(_registry) <= _MAX_ENTRIES:
        # Cheap path: only prune clearly-stale finished entries.
        stale = [k for k, v in _registry.items() if v["done"] and now - v["ts"] > _TTL_DONE]
    else:
        stale = [k for k, v in _registry.items() if now - v["ts"] > _TTL_DONE]
    for k in stale:
        _registry.pop(k, None)


def start(job_id: str) -> None:
    if not job_id:
        return
    with _lock:
        _gc_locked()
        _registry[job_id] = {"percent": 0.0, "stage": "processing", "done": False, "ts": time.monotonic()}


def update(job_id: str, percent: float, stage: str | None = None) -> None:
    if not job_id:
        return
    pct = max(0.0, min(99.0, float(percent)))  # 100 is reserved for finish()
    with _lock:
        entry = _registry.get(job_id)
        if entry is None:
            entry = {"percent": 0.0, "stage": "processing", "done": False, "ts": time.monotonic()}
            _registry[job_id] = entry
        if entry["done"]:
            return
        # Monotonic — never let a noisy reporter walk the bar backwards.
        if pct > entry["percent"]:
            entry["percent"] = pct
        if stage:
            entry["stage"] = stage
        entry["ts"] = time.monotonic()


def finish(job_id: str, ok: bool = True) -> None:
    if not job_id:
        return
    with _lock:
        entry = _registry.get(job_id)
        if entry is None:
            return
        entry["done"] = True
        entry["percent"] = 100.0 if ok else entry["percent"]
        entry["stage"] = "done" if ok else "error"
        entry["ts"] = time.monotonic()


def get(job_id: str) -> dict | None:
    with _lock:
        entry = _registry.get(job_id)
        return dict(entry) if entry else None


# ── Active reporter (ContextVar) ────────────────────────────────────
_Reporter = Callable[[float, str | None], None]


def _noop(_pct: float, _stage: str | None = None) -> None:  # pragma: no cover - trivial
    return None


_reporter: contextvars.ContextVar[_Reporter] = contextvars.ContextVar("progress_reporter", default=_noop)


def bind(job_id: str):
    """Bind the active reporter to `job_id` and return the ContextVar token.

    Must be called before `run_in_threadpool` so the closure is copied into the
    worker thread's context. Pass the token to `unbind` afterwards.
    """
    start(job_id)

    def _report(pct: float, stage: str | None = None) -> None:
        update(job_id, pct, stage)

    return _reporter.set(_report)


def unbind(token) -> None:
    try:
        _reporter.reset(token)
    except (ValueError, LookupError):
        pass


def report(percent: float, stage: str | None = None) -> None:
    """Called by services during long work. No-op unless a job is bound."""
    try:
        _reporter.get()(percent, stage)
    except Exception:  # noqa: BLE001 - progress must never break a job
        pass
