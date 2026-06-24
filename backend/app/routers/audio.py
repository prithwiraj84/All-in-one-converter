"""Audio conversion endpoint."""
from __future__ import annotations

from fastapi import APIRouter, File, Form, UploadFile

from app.core.dependencies import run_or_enqueue
from app.schemas.jobs import JobResult

router = APIRouter(prefix="/api/audio", tags=["audio"])


@router.post("/convert", response_model=JobResult)
async def convert(files: list[UploadFile] = File(...), target: str = Form("mp3")):
    # Heavy + deterministic → cached, and (when QStash is configured) offloaded to
    # the async queue. Falls back to synchronous processing otherwise.
    return await run_or_enqueue("audio/convert", {"target": target}, files)
