"""Archive tool endpoints."""
from __future__ import annotations

from fastapi import APIRouter, File, Form, UploadFile

from app.core.dependencies import run_job
from app.schemas.jobs import JobResult
from app.services import archive_service

router = APIRouter(prefix="/api/archive", tags=["archive"])
ARCHIVES = {".zip", ".tar", ".gz", ".tgz"}


@router.post("/extract", response_model=JobResult)
async def extract(files: list[UploadFile] = File(...)):
    return await run_job(
        files, allowed_exts=ARCHIVES,
        runner=lambda jid, paths, out: archive_service.extract(jid, paths[0], out),
    )


@router.post("/convert", response_model=JobResult)
async def convert(files: list[UploadFile] = File(...), target: str = Form("zip")):
    return await run_job(
        files, allowed_exts=ARCHIVES,
        runner=lambda jid, paths, out: archive_service.convert(jid, paths[0], out, target=target),
    )
