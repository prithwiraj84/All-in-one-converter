"""QStash worker — processes an enqueued heavy job.

QStash POSTs the signed job payload here. We verify the signature, pull the
inputs back from object storage, run the registered task, persist the outputs,
and store the result in the job store for the client to poll at /api/jobs/{id}.
Only exercised when the async queue is configured; otherwise nothing enqueues
here. The signature check rejects any unsigned/forged request."""
from __future__ import annotations

import json
import logging
import shutil

from fastapi import APIRouter, Header, HTTPException, Request, status
from starlette.concurrency import run_in_threadpool

from app.core import cache, jobs_store, object_storage, qstash, supa, tasks
from app.core.dependencies import _persist_outputs
from app.core.quota import guess_mime
from app.core.storage import job_dir

logger = logging.getLogger("aio.worker")
router = APIRouter(prefix="/api/worker", tags=["worker"])


@router.post("/process")
async def process(request: Request, upstash_signature: str | None = Header(None)):
    raw = await request.body()
    if not qstash.verify_signature(upstash_signature, raw):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid signature.")
    try:
        payload = json.loads(raw)
    except Exception:  # noqa: BLE001
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bad payload.")

    job_id = payload.get("job_id")
    task = payload.get("task")
    options = payload.get("options") or {}
    input_keys = payload.get("input_keys") or []
    filenames = payload.get("filenames") or []
    if not job_id or not task:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Missing job_id/task.")

    built = tasks.build(task, options)
    if built is None:
        await jobs_store.update(job_id, status="failed", error=f"unknown task {task}")
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown task.")
    _exts, runner, _multiple = built

    out_dir = job_dir(job_id)
    in_dir = out_dir / "in"
    await jobs_store.update(job_id, status="processing")
    try:
        saved = []
        for key, name in zip(input_keys, filenames):
            dest = in_dir / name
            if not await object_storage.download(key, dest):
                raise RuntimeError(f"input download failed: {key}")
            saved.append(dest)

        # Services are synchronous (CPU / subprocess) — keep the event loop free.
        result = await run_in_threadpool(runner, job_id, saved, out_dir)

        storage_key = None
        if result.status == "completed" and object_storage.enabled():
            storage_key = await _persist_outputs(result, job_id, out_dir)

        # Populate the dedup cache so an identical future job (sync or async)
        # returns instantly — mirrors the synchronous run_job path.
        if result.status == "completed" and not result.files and cache.enabled():
            try:
                key = cache.make_key(
                    [cache.file_hash(p) for p in saved],
                    payload.get("tool") or task, options, payload.get("user_id"),
                )
                await cache.set(key, {
                    "job_id": result.job_id, "tool": result.tool, "download_url": result.download_url,
                    "output_filename": result.output_filename, "output_size": result.output_size,
                    "text": result.text, "meta": result.meta, "storage_key": storage_key,
                })
            except Exception:  # noqa: BLE001
                logger.warning("cache set failed", exc_info=True)

        await jobs_store.update(job_id, status=result.status, result=result.model_dump())

        user_id = payload.get("user_id")
        if user_id and result.status == "completed":
            team_id = await supa.user_team_id(user_id) if payload.get("plan") == "business" else None
            try:
                await supa.record_conversion(
                    user_id, tool=payload.get("tool") or result.tool,
                    source_file=filenames[0] if filenames else None,
                    output_filename=result.output_filename, output_size=result.output_size,
                    download_url=result.download_url, mime=guess_mime(result.output_filename),
                    retention_minutes=payload.get("retention", 60), team_id=team_id,
                )
            except Exception:  # noqa: BLE001 - history must never break a job
                logger.warning("record_conversion failed", exc_info=True)

        shutil.rmtree(in_dir, ignore_errors=True)  # inputs no longer needed
        return {"ok": True, "job_id": job_id, "status": result.status}
    except Exception as exc:  # noqa: BLE001
        logger.exception("worker job failed")
        await jobs_store.update(job_id, status="failed", error=str(exc)[:300])
        # 500 lets QStash retry transient failures (per Upstash-Retries on publish).
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Job failed.")
