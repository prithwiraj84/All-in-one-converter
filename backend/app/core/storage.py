"""Temporary file storage with automatic retention-based cleanup.

Outputs are written to STORAGE_DIR/<job_id>/<filename>. The download route
serves them by (job_id, filename) with path-traversal protection. A background
task deletes job directories older than FILE_RETENTION_MINUTES.
"""
from __future__ import annotations

import asyncio
import logging
import shutil
import time
import uuid
from pathlib import Path

from fastapi import UploadFile

from app.config import settings

logger = logging.getLogger("aio.storage")

CHUNK = 1024 * 1024  # 1 MB


def new_job_id() -> str:
    return uuid.uuid4().hex


def job_dir(job_id: str, create: bool = True) -> Path:
    path = settings.storage_path / job_id
    if create:
        path.mkdir(parents=True, exist_ok=True)
    return path


async def save_upload(upload: UploadFile, dest_dir: Path, *, filename: str | None = None) -> Path:
    """Stream an UploadFile to disk under dest_dir."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    safe_name = Path(filename or upload.filename or "upload.bin").name
    dest = dest_dir / safe_name
    with dest.open("wb") as f:
        while chunk := await upload.read(CHUNK):
            f.write(chunk)
    await upload.seek(0)
    return dest


def public_url(job_id: str, filename: str) -> str:
    """Relative download URL the frontend can resolve against the API base."""
    from urllib.parse import quote

    return f"/api/files/download/{job_id}/{quote(filename)}"


def resolve_download(job_id: str, filename: str) -> Path | None:
    """Return the file path for a download request, or None if invalid/expired."""
    if not job_id.isalnum():
        return None
    base = settings.storage_path / job_id
    target = (base / Path(filename).name).resolve()
    # Path-traversal guard: must stay inside the job directory.
    try:
        target.relative_to(base.resolve())
    except ValueError:
        return None
    return target if target.is_file() else None


def cleanup_expired() -> int:
    """Delete job directories past their per-plan retention window.

    Each job dir carries a `.retain` marker with its retention minutes (written
    at creation: Free 60 · Pro/Business 1 day). Missing marker → the default.
    Returns the number of directories removed.
    """
    now = time.time()
    default_retention = settings.file_retention_minutes
    removed = 0
    root = settings.storage_path
    if not root.exists():
        return 0
    for child in root.iterdir():
        # Skip dotted dirs (.cache/.models hold downloaded AI models) — only job
        # directories (uuid hex) are subject to retention cleanup.
        if child.name.startswith("."):
            continue
        try:
            if not child.is_dir():
                continue
            retain = default_retention
            marker = child / ".retain"
            if marker.is_file():
                try:
                    retain = int(marker.read_text().strip())
                except (ValueError, OSError):
                    pass
            if child.stat().st_mtime < now - retain * 60:
                shutil.rmtree(child, ignore_errors=True)
                removed += 1
        except OSError:
            continue
    if removed:
        logger.info("Cleaned up %d expired job(s)", removed)
    return removed


async def retention_loop(interval_seconds: int = 300) -> None:
    """Background task: periodically purge expired files."""
    while True:
        try:
            cleanup_expired()
        except Exception:  # noqa: BLE001 - never let the loop die
            logger.exception("retention cleanup failed")
        await asyncio.sleep(interval_seconds)
