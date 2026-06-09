"""Document conversion endpoints (LibreOffice + pdfplumber)."""
from __future__ import annotations

from fastapi import APIRouter, File, UploadFile

from app.core.dependencies import run_job
from app.schemas.jobs import JobResult
from app.services import document_service

router = APIRouter(prefix="/api/document", tags=["document"])

DOCX = {".doc", ".docx", ".odt", ".rtf", ".txt"}
XLSX = {".xls", ".xlsx", ".ods", ".csv"}
PPTX = {".ppt", ".pptx", ".odp"}
PDF = {".pdf"}


@router.post("/pdf-to-word", response_model=JobResult)
async def pdf_to_word(files: list[UploadFile] = File(...)):
    return await run_job(
        files, allowed_exts=PDF,
        runner=lambda jid, paths, out: document_service.pdf_to_word(jid, paths[0], out),
    )


@router.post("/word-to-pdf", response_model=JobResult)
async def word_to_pdf(files: list[UploadFile] = File(...)):
    return await run_job(
        files, allowed_exts=DOCX,
        runner=lambda jid, paths, out: document_service.word_to_pdf(jid, paths[0], out),
    )


@router.post("/pdf-to-excel", response_model=JobResult)
async def pdf_to_excel(files: list[UploadFile] = File(...)):
    return await run_job(
        files, allowed_exts=PDF,
        runner=lambda jid, paths, out: document_service.pdf_to_excel(jid, paths[0], out),
    )


@router.post("/excel-to-pdf", response_model=JobResult)
async def excel_to_pdf(files: list[UploadFile] = File(...)):
    return await run_job(
        files, allowed_exts=XLSX,
        runner=lambda jid, paths, out: document_service.excel_to_pdf(jid, paths[0], out),
    )


@router.post("/ppt-to-pdf", response_model=JobResult)
async def ppt_to_pdf(files: list[UploadFile] = File(...)):
    return await run_job(
        files, allowed_exts=PPTX,
        runner=lambda jid, paths, out: document_service.ppt_to_pdf(jid, paths[0], out),
    )
