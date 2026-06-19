"""Job progress stream (Server-Sent Events).

The client opens `GET /api/jobs/{job_id}/progress` right after starting a
processing POST (which carries the same id in `X-Job-Id`) and receives a live
`data: {"percent":..,"stage":..,"done":..}` event roughly twice a second until
the job finishes. Open (no auth / no quota): the id is a client-generated
random token, not a secret, and the stream only exposes a percentage.
"""
from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter
from starlette.responses import StreamingResponse

from app.core import progress

router = APIRouter(prefix="/api/jobs", tags=["jobs"])

_TICK = 0.5  # seconds between events
_MAX_TICKS = 1800  # ~15 min ceiling so a stream can never leak forever


@router.get("/{job_id}/progress")
async def job_progress(job_id: str) -> StreamingResponse:
    async def stream():
        seen = False
        for _ in range(_MAX_TICKS):
            p = progress.get(job_id)
            if p:
                seen = True
                payload = {
                    "percent": round(p["percent"], 1),
                    "stage": p["stage"],
                    "done": p["done"],
                }
                yield f"data: {json.dumps(payload)}\n\n"
                if p["done"]:
                    return
            elif seen:
                # Registered then cleaned up between ticks → treat as finished.
                yield f'data: {json.dumps({"percent": 100, "stage": "done", "done": True})}\n\n'
                return
            else:
                # Job not registered yet (uploads still saving) — keep waiting.
                yield f'data: {json.dumps({"percent": 0, "stage": "starting", "done": False})}\n\n'
            await asyncio.sleep(_TICK)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
