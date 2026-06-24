"""Async-job status store (Upstash Redis). Backs the QStash queue: a job's
lifecycle (queued → processing → completed/failed) + its result are stored here
so the client can poll `GET /api/jobs/{id}`. Redis is required for async; when
it's not configured the queue is off and everything runs synchronously."""
from __future__ import annotations

import json
import logging

from app.config import settings
from app.core import redis_rest

logger = logging.getLogger("aio.jobs")

_TTL = 86400  # keep job records 1 day
_PREFIX = "aio:job:"


def enabled() -> bool:
    return settings.redis_enabled


async def create(job_id: str, user_id: str | None, tool: str) -> None:
    await _put(job_id, {"job_id": job_id, "user_id": user_id, "tool": tool, "status": "queued"})


async def get(job_id: str) -> dict | None:
    raw = await redis_rest.get(_PREFIX + job_id)
    if not raw:
        return None
    try:
        return json.loads(raw)
    except Exception:  # noqa: BLE001
        return None


async def update(job_id: str, **fields) -> None:
    cur = await get(job_id) or {"job_id": job_id}
    cur.update(fields)
    await _put(job_id, cur)


async def _put(job_id: str, data: dict) -> None:
    await redis_rest.setex(_PREFIX + job_id, _TTL, json.dumps(data))
