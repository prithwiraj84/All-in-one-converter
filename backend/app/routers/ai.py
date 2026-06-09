"""AI tool endpoints."""
from __future__ import annotations

from fastapi import APIRouter, File, Form, UploadFile

from app.core.dependencies import run_job
from app.schemas.jobs import JobResult
from app.services import ai_service

router = APIRouter(prefix="/api/ai", tags=["ai"])
DOCS = {".pdf", ".txt"}


@router.post("/summarize", response_model=JobResult)
async def summarize(files: list[UploadFile] = File(...), max_sentences: int = Form(7)):
    return await run_job(
        files, allowed_exts=DOCS,
        runner=lambda jid, paths, out: ai_service.summarize(jid, paths[0], max_sentences=max_sentences),
    )
