"""Image tool endpoints."""
from __future__ import annotations

from fastapi import APIRouter, File, Form, UploadFile

from app.core.dependencies import run_job
from app.schemas.jobs import JobResult
from app.services import image_service

router = APIRouter(prefix="/api/image", tags=["image"])
IMG = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tiff", ".tif"}


@router.post("/convert", response_model=JobResult)
async def convert(files: list[UploadFile] = File(...), target: str = Form("png")):
    return await run_job(
        files, allowed_exts=IMG, multiple=True,
        runner=lambda jid, paths, out: image_service.convert(jid, paths, out, target=target),
    )


@router.post("/resize", response_model=JobResult)
async def resize(
    files: list[UploadFile] = File(...),
    width: int = Form(1280),
    height: int = Form(720),
    keep_ratio: bool = Form(True),
):
    return await run_job(
        files, allowed_exts=IMG, multiple=True,
        runner=lambda jid, paths, out: image_service.resize(jid, paths, out, width=width, height=height, keep_ratio=keep_ratio),
    )


@router.post("/compress", response_model=JobResult)
async def compress(files: list[UploadFile] = File(...), quality: int = Form(80)):
    return await run_job(
        files, allowed_exts=IMG, multiple=True,
        runner=lambda jid, paths, out: image_service.compress(jid, paths, out, quality=quality),
    )
