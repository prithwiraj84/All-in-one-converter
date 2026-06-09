"""Audio conversion endpoint."""
from __future__ import annotations

from fastapi import APIRouter, File, Form, UploadFile

from app.core.dependencies import run_job
from app.schemas.jobs import JobResult
from app.services import media_service

router = APIRouter(prefix="/api/audio", tags=["audio"])
AUDIO = {".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a"}


@router.post("/convert", response_model=JobResult)
async def convert(files: list[UploadFile] = File(...), target: str = Form("mp3")):
    return await run_job(
        files, allowed_exts=AUDIO,
        runner=lambda jid, paths, out: media_service.audio_convert(jid, paths[0], out, target=target),
    )
