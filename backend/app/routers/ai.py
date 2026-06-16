"""AI tool endpoints — summarize, image AI, speech/audio AI, and translation."""
from __future__ import annotations

from fastapi import APIRouter, File, Form, UploadFile

from app.core.dependencies import run_job
from app.schemas.jobs import JobResult
from app.services import ai_image_service, ai_media_service, ai_service, ai_translate_service

router = APIRouter(prefix="/api/ai", tags=["ai"])

DOCS = {".pdf", ".txt"}                 # summarizer (extractive)
DOC_TEXT = {".pdf", ".docx", ".txt"}    # TTS + translator
IMG = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tiff", ".tif"}
AV = {".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a", ".mp4", ".webm", ".mov", ".avi", ".mkv"}


@router.post("/summarize", response_model=JobResult)
async def summarize(files: list[UploadFile] = File(...), max_sentences: int = Form(7)):
    return await run_job(
        files, allowed_exts=DOCS,
        runner=lambda jid, paths, out: ai_service.summarize(jid, paths[0], max_sentences=max_sentences),
    )


# ── Image AI ────────────────────────────────────────────────────────
@router.post("/remove-background", response_model=JobResult)
async def remove_background(
    files: list[UploadFile] = File(...),
    model: str = Form("general"),
    background: str = Form("transparent"),
    edges: bool = Form(False),
):
    return await run_job(
        files, allowed_exts=IMG,
        runner=lambda jid, paths, out: ai_image_service.remove_background(
            jid, paths[0], out, model=model, background=background, edges=edges
        ),
    )


@router.post("/upscale", response_model=JobResult)
async def upscale(
    files: list[UploadFile] = File(...),
    scale: int = Form(2),
    denoise: bool = Form(False),
    sharpen: bool = Form(True),
):
    return await run_job(
        files, allowed_exts=IMG,
        runner=lambda jid, paths, out: ai_image_service.upscale(
            jid, paths[0], out, scale=scale, denoise=denoise, sharpen=sharpen
        ),
    )


@router.post("/restore", response_model=JobResult)
async def restore(
    files: list[UploadFile] = File(...),
    colorize: bool = Form(False),
    enhance: bool = Form(True),
):
    return await run_job(
        files, allowed_exts=IMG,
        runner=lambda jid, paths, out: ai_image_service.restore(
            jid, paths[0], out, colorize=colorize, enhance=enhance
        ),
    )


@router.post("/caption", response_model=JobResult)
async def caption(
    files: list[UploadFile] = File(...),
    style: str = Form("alt"),
    language: str = Form("English"),
):
    return await run_job(
        files, allowed_exts=IMG,
        runner=lambda jid, paths, out: ai_image_service.caption(jid, paths[0], style=style, language=language),
    )


# ── Speech / audio AI ───────────────────────────────────────────────
@router.post("/transcribe", response_model=JobResult)
async def transcribe(
    files: list[UploadFile] = File(...),
    language: str = Form("auto"),
    translate: bool = Form(False),
):
    return await run_job(
        files, allowed_exts=AV,
        runner=lambda jid, paths, out: ai_media_service.transcribe(
            jid, paths[0], out, language=language, translate=translate
        ),
    )


@router.post("/subtitles", response_model=JobResult)
async def subtitles(
    files: list[UploadFile] = File(...),
    format: str = Form("srt"),
    language: str = Form("auto"),
    translate: bool = Form(False),
):
    return await run_job(
        files, allowed_exts=AV,
        runner=lambda jid, paths, out: ai_media_service.subtitles(
            jid, paths[0], out, fmt=format, language=language, translate=translate
        ),
    )


@router.post("/text-to-speech", response_model=JobResult)
async def text_to_speech(
    files: list[UploadFile] = File(...),
    voice: str = Form("en-US-JennyNeural"),
    speed: str = Form("normal"),
):
    return await run_job(
        files, allowed_exts=DOC_TEXT,
        runner=lambda jid, paths, out: ai_media_service.text_to_speech(
            jid, paths[0], out, voice=voice, speed=speed
        ),
    )


# ── Translation ─────────────────────────────────────────────────────
@router.post("/translate", response_model=JobResult)
async def translate(
    files: list[UploadFile] = File(...),
    target: str = Form("es"),
    source: str = Form("auto"),
    format: str = Form("docx"),
):
    return await run_job(
        files, allowed_exts=DOC_TEXT,
        runner=lambda jid, paths, out: ai_translate_service.translate(
            jid, paths[0], out, target=target, source=source, fmt=format
        ),
    )
