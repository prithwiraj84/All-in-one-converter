"""OCR endpoints."""
from __future__ import annotations

from fastapi import APIRouter, File, Form, UploadFile

from app.core.dependencies import run_job
from app.schemas.jobs import JobResult
from app.services import ocr_service

router = APIRouter(prefix="/api/ocr", tags=["ocr"])
IMG = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tiff", ".tif"}
PDF = {".pdf"}


@router.post("/image", response_model=JobResult)
async def image_to_text(files: list[UploadFile] = File(...), lang: str = Form("eng")):
    return await run_job(
        files, allowed_exts=IMG,
        runner=lambda jid, paths, out: ocr_service.image_to_text(jid, paths[0], lang=lang),
    )


@router.post("/pdf", response_model=JobResult)
async def pdf_to_text(files: list[UploadFile] = File(...), lang: str = Form("eng")):
    return await run_job(
        files, allowed_exts=PDF,
        runner=lambda jid, paths, out: ocr_service.pdf_to_text(jid, paths[0], lang=lang),
    )
