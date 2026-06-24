"""Object storage for output files — Supabase Storage backend.

Default backend is "local" (disk + the /api/files/download route), unchanged.
When STORAGE_BACKEND=supabase, outputs are uploaded to a bucket and served via
time-limited signed URLs (persistent across restarts, CDN-delivered, multi-worker
safe). All calls are best-effort; callers fall back to local on failure.
"""
from __future__ import annotations

import logging
import mimetypes
from pathlib import Path

import httpx

from app.config import settings

logger = logging.getLogger("aio.objstore")
_TIMEOUT = httpx.Timeout(30.0)


def enabled() -> bool:
    return settings.storage_backend == "supabase" and bool(
        settings.supabase_url and settings.supabase_service_role_key
    )


def output_key(job_id: str, filename: str) -> str:
    return f"outputs/{job_id}/{Path(filename).name}"


def input_key(job_id: str, filename: str) -> str:
    return f"inputs/{job_id}/{Path(filename).name}"


async def download(key: str, local_path: Path) -> bool:
    """Pull an object back to local disk (used by the async worker for inputs)."""
    if not enabled():
        return False
    url = f"{settings.supabase_url}/storage/v1/object/{settings.storage_bucket}/{key}"
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(url, headers=_headers())
        if resp.status_code >= 300:
            logger.warning("object download failed: %s %s", resp.status_code, resp.text[:200])
            return False
        local_path.parent.mkdir(parents=True, exist_ok=True)
        local_path.write_bytes(resp.content)
        return True
    except Exception:  # noqa: BLE001
        logger.warning("object download error", exc_info=True)
        return False


def _headers(content_type: str | None = None) -> dict[str, str]:
    key = settings.supabase_service_role_key or ""
    h = {"apikey": key, "Authorization": f"Bearer {key}"}
    if content_type:
        h["Content-Type"] = content_type
    return h


async def upload(local_path: Path, key: str) -> bool:
    if not enabled():
        return False
    ctype = mimetypes.guess_type(local_path.name)[0] or "application/octet-stream"
    url = f"{settings.supabase_url}/storage/v1/object/{settings.storage_bucket}/{key}"
    try:
        data = local_path.read_bytes()
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(url, headers={**_headers(ctype), "x-upsert": "true"}, content=data)
        if resp.status_code < 300:
            return True
        logger.warning("object upload failed: %s %s", resp.status_code, resp.text[:200])
    except Exception:  # noqa: BLE001
        logger.warning("object upload error", exc_info=True)
    return False


async def signed_url(key: str, ttl: int | None = None) -> str | None:
    if not enabled():
        return None
    ttl = ttl or settings.storage_signed_url_ttl
    url = f"{settings.supabase_url}/storage/v1/object/sign/{settings.storage_bucket}/{key}"
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(url, headers={**_headers("application/json")}, json={"expiresIn": ttl})
        resp.raise_for_status()
        signed = resp.json().get("signedURL") or resp.json().get("signedUrl")
        if not signed:
            return None
        # Supabase returns a path like "/object/sign/<bucket>/<key>?token=..."
        return f"{settings.supabase_url}/storage/v1{signed}"
    except Exception:  # noqa: BLE001
        logger.warning("signed_url error", exc_info=True)
        return None


async def put_output(local_path: Path, job_id: str) -> tuple[str | None, str | None]:
    """Upload an output file and return (storage_key, signed_url), or (None, None)."""
    key = output_key(job_id, local_path.name)
    if not await upload(local_path, key):
        return None, None
    return key, await signed_url(key)


async def delete_prefix(job_id: str) -> None:
    """Delete all objects for a job (inputs + outputs), best-effort cleanup."""
    if not enabled():
        return
    list_url = f"{settings.supabase_url}/storage/v1/object/list/{settings.storage_bucket}"
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            names: list[str] = []
            for folder in (f"outputs/{job_id}", f"inputs/{job_id}"):
                lr = await client.post(
                    list_url, headers=_headers("application/json"), json={"prefix": folder}
                )
                names += [f"{folder}/{o['name']}" for o in (lr.json() or []) if o.get("name")]
            if names:
                await client.request(
                    "DELETE",
                    f"{settings.supabase_url}/storage/v1/object/{settings.storage_bucket}",
                    headers=_headers("application/json"),
                    json={"prefixes": names},
                )
    except Exception:  # noqa: BLE001
        logger.warning("delete_prefix error", exc_info=True)
