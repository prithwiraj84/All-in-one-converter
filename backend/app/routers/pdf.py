"""PDF tool endpoints."""
from __future__ import annotations

from fastapi import APIRouter, File, Form, UploadFile

from app.core.dependencies import run_job
from app.schemas.jobs import JobResult
from app.services import pdf_service

router = APIRouter(prefix="/api/pdf", tags=["pdf"])
PDF = {".pdf"}


@router.post("/merge", response_model=JobResult)
async def merge(files: list[UploadFile] = File(...)):
    return await run_job(
        files, allowed_exts=PDF, multiple=True, min_files=2,
        runner=lambda jid, paths, out: pdf_service.merge(jid, paths, out),
    )


@router.post("/split", response_model=JobResult)
async def split(files: list[UploadFile] = File(...), ranges: str = Form("")):
    return await run_job(
        files, allowed_exts=PDF,
        runner=lambda jid, paths, out: pdf_service.split(jid, paths[0], out, ranges=ranges),
    )


@router.post("/compress", response_model=JobResult)
async def compress(files: list[UploadFile] = File(...), level: str = Form("recommended")):
    return await run_job(
        files, allowed_exts=PDF,
        runner=lambda jid, paths, out: pdf_service.compress(jid, paths[0], out, level=level),
    )


@router.post("/rotate", response_model=JobResult)
async def rotate(files: list[UploadFile] = File(...), angle: int = Form(90)):
    return await run_job(
        files, allowed_exts=PDF,
        runner=lambda jid, paths, out: pdf_service.rotate(jid, paths[0], out, angle=angle),
    )


@router.post("/protect", response_model=JobResult)
async def protect(files: list[UploadFile] = File(...), password: str = Form(...)):
    return await run_job(
        files, allowed_exts=PDF,
        runner=lambda jid, paths, out: pdf_service.protect(jid, paths[0], out, password=password),
    )


@router.post("/unlock", response_model=JobResult)
async def unlock(files: list[UploadFile] = File(...), password: str = Form("")):
    return await run_job(
        files, allowed_exts=PDF,
        runner=lambda jid, paths, out: pdf_service.unlock(jid, paths[0], out, password=password),
    )


@router.post("/page-numbers", response_model=JobResult)
async def page_numbers(
    files: list[UploadFile] = File(...),
    position: str = Form("bottom-center"),
    start: int = Form(1),
):
    return await run_job(
        files, allowed_exts=PDF,
        runner=lambda jid, paths, out: pdf_service.page_numbers(jid, paths[0], out, position=position, start=start),
    )


@router.post("/watermark", response_model=JobResult)
async def watermark(
    files: list[UploadFile] = File(...),
    text: str = Form("CONFIDENTIAL"),
    opacity: int = Form(30),
):
    return await run_job(
        files, allowed_exts=PDF,
        runner=lambda jid, paths, out: pdf_service.watermark(jid, paths[0], out, text=text, opacity=opacity),
    )
