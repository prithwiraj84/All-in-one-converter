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
from app.core import cache, jobs_store, object_storage, progress, qstash, supa, tasks
from app.schemas.jobs import JobResult

# A runner takes (job_id, saved_paths, out_dir) and returns a JobResult.
Runner = Callable[[str, list[Path], Path], JobResult]


async def _result_from_cache(cached: dict, fallback_job_id: str) -> JobResult | None:
    """Rebuild a JobResult from a cache entry, re-signing object-storage URLs and
    verifying local files still exist. Returns None if the output is gone (→ miss)."""
    fname = cached.get("output_filename")
    download_url = cached.get("download_url")
    if cached.get("storage_key") and object_storage.enabled():
        fresh = await object_storage.signed_url(cached["storage_key"])
        if not fresh:
            return None
        download_url = fresh
    elif fname:
        from app.core.storage import resolve_download

        if resolve_download(cached.get("job_id", ""), fname) is None:
            return None
    elif cached.get("text") is None:
        return None
    return JobResult(
        job_id=cached.get("job_id", fallback_job_id),
        tool=cached.get("tool", "cached"),
        status="completed",
        download_url=download_url,
        output_filename=fname,
        output_size=cached.get("output_size"),
        text=cached.get("text"),
        meta={**(cached.get("meta") or {}), "cached": True},
    )


async def _persist_outputs(result: JobResult, job_id: str, out_dir: Path) -> str | None:
    """Upload a completed job's output file(s) to object storage and rewrite the
    download URLs to signed URLs. Returns the primary file's storage key."""
    primary_key: str | None = None
    if result.output_filename and result.download_url:
        p = out_dir / result.output_filename
        if p.is_file():
            key, url = await object_storage.put_output(p, job_id)
            if url:
                result.download_url = url
                primary_key = key
    for fe in result.files or []:
        p = out_dir / fe.name
        if p.is_file():
            _, url = await object_storage.put_output(p, job_id)
            if url:
                fe.download_url = url
    return primary_key


async def run_job(
    files: list[UploadFile],
    *,
    runner: Runner,
    allowed_exts: set[str] | None = None,
    multiple: bool = False,
    min_files: int = 1,
    cache_options: dict | None = None,
) -> JobResult:
    """Validate uploads, persist them, run the service, return a JobResult."""
    if not files:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No files were uploaded.")
    if not multiple:
        files = files[:1]
    if len(files) < min_files:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Please upload at least {min_files} file(s).")

    # enforce_quota set the context (plan, API-key flags, tool for attribution).
    ctx = current_quota()
    api_status = 200
    try:
        for f in files:
            validate_upload(f, allowed_exts=allowed_exts)

        # Per-file size cap follows the caller's plan (Free 10 MB · Pro 1 GB),
        # bounded by the absolute server ceiling.
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
        cache_key: str | None = None
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

            # ── Cache: short-circuit an identical prior conversion (opt-in tools) ──
            if cache_options is not None and cache.enabled():
                try:
                    cache_key = cache.make_key(
                        [cache.file_hash(p) for p in saved],
                        (ctx.tool if ctx else "") or "",
                        cache_options,
                        ctx.user_id if ctx else None,
                    )
                    cached = await cache.get(cache_key)
                except Exception:  # noqa: BLE001
                    cache_key, cached = None, None
                if cached:
                    hit = await _result_from_cache(cached, job_id)
                    if hit:
                        if ctx and ctx.user_id:
                            team_id = await supa.user_team_id(ctx.user_id) if ctx.plan == "business" else None
                            try:
                                await supa.record_conversion(
                                    ctx.user_id, tool=ctx.tool or hit.tool,
                                    source_file=saved[0].name if saved else None,
                                    output_filename=hit.output_filename, output_size=hit.output_size,
                                    download_url=hit.download_url, mime=guess_mime(hit.output_filename),
                                    retention_minutes=retention, team_id=team_id,
                                )
                            except Exception:  # noqa: BLE001
                                pass
                        return hit

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

        # Persist outputs to object storage (rewrites download_url to signed URLs)
        # when STORAGE_BACKEND=supabase. No-op (local disk) by default.
        storage_key = None
        if result.status == "completed" and object_storage.enabled():
            storage_key = await _persist_outputs(result, job_id, out_dir)

        # Cache the result so an identical future conversion returns instantly
        # (single-file / text outputs only; opt-in via cache_options + CACHE_BACKEND).
        if cache_key and result.status == "completed" and not result.files:
            try:
                await cache.set(cache_key, {
                    "job_id": result.job_id, "tool": result.tool, "download_url": result.download_url,
                    "output_filename": result.output_filename, "output_size": result.output_size,
                    "text": result.text, "meta": result.meta, "storage_key": storage_key,
                })
            except Exception:  # noqa: BLE001
                pass

        # Authoritative history + usage: record for signed-in users (best-effort).
        # Team members/owners (effective Business) tag the file so the team can
        # see it in the shared "Team files" view, with the converter name.
        if ctx and ctx.user_id and result.status == "completed":
            team_id = await supa.user_team_id(ctx.user_id) if ctx.plan == "business" else None
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
                    team_id=team_id,
                )
            except Exception:  # noqa: BLE001 - history must never break a job
                pass

        return result
    except HTTPException as exc:
        api_status = exc.status_code
        raise
    except Exception:
        api_status = 500
        raise
    finally:
        # Log REST-API requests (success + error) for usage analytics — fire and
        # forget (retained internally so it isn't GC'd) so it never slows the response.
        if ctx and ctx.via_api_key and ctx.user_id:
            supa.log_api_request_bg(ctx.user_id, ctx.api_key_id, ctx.tool, api_status)


async def run_or_enqueue(
    task: str, options: dict, files: list[UploadFile], *, min_files: int = 1
) -> JobResult:
    """Dispatch a registered heavy task. Runs synchronously by default (identical
    to calling run_job directly). When the async queue — QStash + Redis + object
    storage — is configured AND the task is offload-eligible, the job is enqueued
    and a `queued` JobResult is returned for the client to poll at /api/jobs/{id}.
    Any hand-off failure falls back to synchronous processing, so a result is
    always produced."""
    built = tasks.build(task, options)
    if built is None:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Unknown task '{task}'.")
    allowed_exts, runner, multiple = built

    if (
        tasks.should_offload(task)
        and qstash.enabled()
        and jobs_store.enabled()
        and object_storage.enabled()
    ):
        queued = await _enqueue(task, options, files, allowed_exts, multiple, min_files)
        if queued is not None:
            return queued  # else: hand-off failed → fall through to sync

    return await run_job(
        files, runner=runner, allowed_exts=allowed_exts,
        multiple=multiple, min_files=min_files, cache_options=options,
    )


async def _enqueue(
    task: str, options: dict, files: list[UploadFile],
    allowed_exts: set[str] | None, multiple: bool, min_files: int,
) -> JobResult | None:
    """Validate + stash inputs in object storage and publish a QStash message.
    Returns a queued JobResult, or None if the hand-off failed (caller runs sync)."""
    if not files:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No files were uploaded.")
    if not multiple:
        files = files[:1]
    if len(files) < min_files:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Please upload at least {min_files} file(s).")

    ctx = current_quota()
    for f in files:
        validate_upload(f, allowed_exts=allowed_exts)
    plan_label = ctx.limits.label if ctx else "Free"
    max_bytes = min(ctx.limits.max_file_bytes, settings.max_upload_bytes) if ctx else settings.max_upload_bytes
    retention = retention_minutes_for(ctx.plan if ctx else "free")

    job_id = new_job_id()
    out_dir = job_dir(job_id)
    in_dir = out_dir / "in"
    try:
        (out_dir / ".retain").write_text(str(retention))
    except OSError:
        pass

    input_keys: list[str] = []
    filenames: list[str] = []
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
    except HTTPException:
        shutil.rmtree(out_dir, ignore_errors=True)
        raise

    # Dedup: if this exact job was processed before, return it now — no queue.
    if cache.enabled():
        try:
            ckey = cache.make_key(
                [cache.file_hash(p) for p in saved],
                (ctx.tool if ctx else "") or "", options, ctx.user_id if ctx else None,
            )
            cached = await cache.get(ckey)
        except Exception:  # noqa: BLE001
            cached = None
        if cached:
            hit = await _result_from_cache(cached, job_id)
            if hit:
                shutil.rmtree(out_dir, ignore_errors=True)
                return hit

    # Hand the inputs to object storage so the worker (possibly another instance)
    # can pull them back.
    for path in saved:
        key = object_storage.input_key(job_id, path.name)
        if not await object_storage.upload(path, key):
            shutil.rmtree(out_dir, ignore_errors=True)
            return None  # can't hand inputs to the worker → sync fallback
        input_keys.append(key)
        filenames.append(path.name)

    await jobs_store.create(job_id, ctx.user_id if ctx else None, ctx.tool if ctx else task)
    worker_url = settings.backend_public_url.rstrip("/") + "/api/worker/process"
    payload = {
        "job_id": job_id, "task": task, "options": options or {},
        "input_keys": input_keys, "filenames": filenames,
        "user_id": ctx.user_id if ctx else None,
        "plan": ctx.plan if ctx else "free",
        "tool": ctx.tool if ctx else task,
        "retention": retention,
    }
    if not await qstash.publish_json(worker_url, payload):
        await jobs_store.update(job_id, status="failed", error="enqueue failed")
        shutil.rmtree(out_dir, ignore_errors=True)
        return None  # publish failed → sync fallback

    if ctx and ctx.via_api_key and ctx.user_id:
        supa.log_api_request_bg(ctx.user_id, ctx.api_key_id, ctx.tool, 202)
    return JobResult(
        job_id=job_id, tool=ctx.tool if ctx else task, status="queued",
        meta={"queued": True, "poll_url": f"/api/jobs/{job_id}"},
    )
