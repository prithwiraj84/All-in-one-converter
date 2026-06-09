"""Shared request-handling pipeline for all processing endpoints."""
from __future__ import annotations

import shutil
from collections.abc import Callable
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.core.security import scan_for_malware, validate_upload
from app.core.storage import job_dir, new_job_id, save_upload
from app.schemas.jobs import JobResult

# A runner takes (job_id, saved_paths, out_dir) and returns a JobResult.
Runner = Callable[[str, list[Path], Path], JobResult]


async def run_job(
    files: list[UploadFile],
    *,
    runner: Runner,
    allowed_exts: set[str] | None = None,
    multiple: bool = False,
    min_files: int = 1,
) -> JobResult:
    """Validate uploads, persist them, run the service, return a JobResult."""
    if not files:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No files were uploaded.")
    if not multiple:
        files = files[:1]
    if len(files) < min_files:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Please upload at least {min_files} file(s).")

    for f in files:
        validate_upload(f, allowed_exts=allowed_exts)

    job_id = new_job_id()
    out_dir = job_dir(job_id)
    in_dir = out_dir / "in"

    saved: list[Path] = []
    try:
        for f in files:
            path = await save_upload(f, in_dir)
            if path.stat().st_size > settings.max_upload_bytes:
                raise HTTPException(
                    status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    f"'{path.name}' exceeds the {settings.max_upload_mb} MB limit.",
                )
            if not scan_for_malware(path):
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "File failed the security scan.")
            saved.append(path)

        # Services are synchronous (CPU / subprocess) — keep the event loop free.
        return await run_in_threadpool(runner, job_id, saved, out_dir)
    except HTTPException:
        shutil.rmtree(out_dir, ignore_errors=True)
        raise
