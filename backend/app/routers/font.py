"""Font conversion endpoint."""
from __future__ import annotations

from fastapi import APIRouter, File, Form, UploadFile

from app.core.dependencies import run_job
from app.schemas.jobs import JobResult
from app.services import font_service

router = APIRouter(prefix="/api/font", tags=["font"])
FONTS = {".ttf", ".otf", ".woff", ".woff2"}


@router.post("/convert", response_model=JobResult)
async def convert(files: list[UploadFile] = File(...), target: str = Form("woff2")):
    return await run_job(
        files, allowed_exts=FONTS,
        runner=lambda jid, paths, out: font_service.convert(jid, paths[0], out, target=target),
    )
