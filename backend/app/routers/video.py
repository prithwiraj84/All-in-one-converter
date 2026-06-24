"""Video conversion endpoint."""
from __future__ import annotations

from fastapi import APIRouter, File, Form, UploadFile

from app.core.dependencies import run_or_enqueue
from app.schemas.jobs import JobResult

router = APIRouter(prefix="/api/video", tags=["video"])


@router.post("/convert", response_model=JobResult)
async def convert(files: list[UploadFile] = File(...), target: str = Form("mp4")):
    # Heavy + deterministic → cached, and (when QStash is configured) offloaded to
    # the async queue. Falls back to synchronous processing otherwise.
    return await run_or_enqueue("video/convert", {"target": target}, files)
