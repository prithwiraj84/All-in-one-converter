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
from app.core.quota import current_quota, fmt_bytes, guess_mime, retention_minutes_for
from app.core import progress, supa
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

    # Per-file size cap follows the caller's plan (Free 10 MB · Pro 1 GB),
    # bounded by the absolute server ceiling. enforce_quota set the context.
    ctx = current_quota()
    plan_label = ctx.limits.label if ctx else "Free"
    max_bytes = min(ctx.limits.max_file_bytes, settings.max_upload_bytes) if ctx else settings.max_upload_bytes

    retention = retention_minutes_for(ctx.plan if ctx else "free")

    job_id = new_job_id()
    out_dir = job_dir(job_id)
    in_dir = out_dir / "in"
    # Stamp the per-plan retention so the cleanup loop deletes this job at the
    # right time (Free 60 min · Pro/Business 1 day), not the global default.
    try:
        (out_dir / ".retain").write_text(str(retention))
    except OSError:
        pass

    saved: list[Path] = []
    try:
        for f in files:
            path = await save_upload(f, in_dir)
            if path.stat().st_size > max_bytes:
                raise HTTPException(
                    status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    f"'{path.name}' exceeds the {fmt_bytes(max_bytes)} per-file limit on the {plan_label} plan.",
                )
            if not scan_for_malware(path):
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "File failed the security scan.")
            saved.append(path)

        # Bind a progress reporter (if the client opted in via X-Job-Id) so long
        # services can stream a real percentage. The ContextVar is copied into
        # the threadpool worker by anyio; report() is a no-op when nothing's bound.
        progress_id = ctx.progress_id if ctx else None
        token = progress.bind(progress_id) if progress_id else None
        try:
            # Services are synchronous (CPU / subprocess) — keep the event loop free.
            result = await run_in_threadpool(runner, job_id, saved, out_dir)
        finally:
            if progress_id:
                progress.finish(progress_id, ok=True)
                progress.unbind(token)
    except HTTPException:
        shutil.rmtree(out_dir, ignore_errors=True)
        raise

    # Authoritative history + usage: record for signed-in users (best-effort).
    if ctx and ctx.user_id and result.status == "completed":
        try:
            await supa.record_conversion(
                ctx.user_id,
                tool=ctx.tool or result.tool,
                source_file=saved[0].name if saved else None,
                output_filename=result.output_filename,
                output_size=result.output_size,
                download_url=result.download_url,
                mime=guess_mime(result.output_filename),
                retention_minutes=retention,
            )
        except Exception:  # noqa: BLE001 - history must never break a job
            pass

    return result
