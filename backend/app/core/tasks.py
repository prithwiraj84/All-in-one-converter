"""Async task dispatch registry.

The sync endpoints pass a `runner` lambda to run_job, which can't be serialized
for the queue. So heavy tools also register here under a stable `task` key: the
worker rebuilds the same runner from `{task, options}` after pulling the inputs
back out of object storage. Only tools listed here are eligible for async
offload; everything else always runs synchronously.

Each entry: task -> (allowed_exts, build_runner(options) -> Runner, multiple).
"""
from __future__ import annotations

from typing import Callable

from app.schemas.jobs import JobResult
from app.services import document_service, image_service, media_service

Runner = Callable[[str, list, object], JobResult]

IMG = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tiff", ".tif"}
VIDEO = {".mp4", ".webm", ".mov", ".avi", ".mkv"}
AUDIO = {".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a"}
DOCX = {".doc", ".docx", ".odt", ".rtf", ".txt"}
XLSX = {".xls", ".xlsx", ".ods", ".csv"}
PPTX = {".ppt", ".pptx", ".odp"}
PDF = {".pdf"}


def _video_convert(o: dict) -> Runner:
    t = o.get("target", "mp4")
    return lambda jid, paths, out: media_service.video_convert(jid, paths[0], out, target=t)


def _audio_convert(o: dict) -> Runner:
    t = o.get("target", "mp3")
    return lambda jid, paths, out: media_service.audio_convert(jid, paths[0], out, target=t)


def _image_convert(o: dict) -> Runner:
    t = o.get("target", "png")
    return lambda jid, paths, out: image_service.convert(jid, paths, out, target=t)


def _image_resize(o: dict) -> Runner:
    return lambda jid, paths, out: image_service.resize(
        jid, paths, out,
        width=int(o.get("width", 1280)), height=int(o.get("height", 720)),
        keep_ratio=bool(o.get("keep_ratio", True)), target=o.get("target", "png"),
    )


def _image_compress(o: dict) -> Runner:
    q = int(o.get("quality", 80))
    return lambda jid, paths, out: image_service.compress(jid, paths, out, quality=q)


def _doc(fn) -> Callable[[dict], Runner]:
    return lambda o: (lambda jid, paths, out: fn(jid, paths[0], out))


# task -> (allowed_exts, build_runner, multiple)
REGISTRY: dict[str, tuple[set[str], Callable[[dict], Runner], bool]] = {
    "video/convert": (VIDEO, _video_convert, False),
    "audio/convert": (AUDIO, _audio_convert, False),
    "image/convert": (IMG, _image_convert, True),
    "image/resize": (IMG, _image_resize, True),
    "image/compress": (IMG, _image_compress, True),
    "document/pdf-to-word": (PDF, _doc(document_service.pdf_to_word), False),
    "document/word-to-pdf": (DOCX, _doc(document_service.word_to_pdf), False),
    "document/pdf-to-excel": (PDF, _doc(document_service.pdf_to_excel), False),
    "document/excel-to-pdf": (XLSX, _doc(document_service.excel_to_pdf), False),
    "document/ppt-to-pdf": (PPTX, _doc(document_service.ppt_to_pdf), False),
}


# Only genuinely slow tools are worth the queue round-trip; fast tools (image)
# stay synchronous even when the queue is configured.
HEAVY = {
    "video/convert", "audio/convert",
    "document/pdf-to-word", "document/word-to-pdf", "document/pdf-to-excel",
    "document/excel-to-pdf", "document/ppt-to-pdf",
}


def is_async_eligible(task: str) -> bool:
    return task in REGISTRY


def should_offload(task: str) -> bool:
    return task in HEAVY


def build(task: str, options: dict):
    """Return (allowed_exts, runner, multiple) for a task, or None if unknown."""
    entry = REGISTRY.get(task)
    if not entry:
        return None
    allowed_exts, factory, multiple = entry
    return allowed_exts, factory(options or {}), multiple
