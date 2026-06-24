"""Document conversion endpoints (LibreOffice + pdfplumber).

All five conversions are heavy (LibreOffice subprocess) and deterministic, so
they're cached and — when QStash is configured — offloaded to the async queue
via run_or_enqueue. Without the queue they run synchronously, exactly as before.
"""
from __future__ import annotations

from fastapi import APIRouter, File, UploadFile

from app.core.dependencies import run_or_enqueue
from app.schemas.jobs import JobResult

router = APIRouter(prefix="/api/document", tags=["document"])


@router.post("/pdf-to-word", response_model=JobResult)
async def pdf_to_word(files: list[UploadFile] = File(...)):
    return await run_or_enqueue("document/pdf-to-word", {}, files)


@router.post("/word-to-pdf", response_model=JobResult)
async def word_to_pdf(files: list[UploadFile] = File(...)):
    return await run_or_enqueue("document/word-to-pdf", {}, files)


@router.post("/pdf-to-excel", response_model=JobResult)
async def pdf_to_excel(files: list[UploadFile] = File(...)):
    return await run_or_enqueue("document/pdf-to-excel", {}, files)


@router.post("/excel-to-pdf", response_model=JobResult)
async def excel_to_pdf(files: list[UploadFile] = File(...)):
    return await run_or_enqueue("document/excel-to-pdf", {}, files)


@router.post("/ppt-to-pdf", response_model=JobResult)
async def ppt_to_pdf(files: list[UploadFile] = File(...)):
    return await run_or_enqueue("document/ppt-to-pdf", {}, files)
