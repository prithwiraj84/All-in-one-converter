"""Result cache / content-hash dedup for deterministic conversions.

Key = sha256(input bytes) + tool + options (+ user_id unless CACHE_CROSS_USER).
Backends: "off" (default), "redis" (Upstash) or "supabase" (a conversion_cache
table). A hit returns the previously produced output, skipping reprocessing.
Only the caller decides what's cacheable (it passes `cache_options`), and AI /
non-deterministic tools are never cached.
"""
from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx

from app.config import settings
from app.core import redis_rest

logger = logging.getLogger("aio.cache")
_TIMEOUT = httpx.Timeout(5.0)
_NS = "aio:cache:"


def enabled() -> bool:
    if settings.cache_backend == "redis":
        return redis_rest.enabled()
    if settings.cache_backend == "supabase":
        return bool(settings.supabase_url and settings.supabase_service_role_key)
    return False


def file_hash(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def make_key(input_hashes: list[str], tool: str, options: dict, user_id: str | None) -> str:
    base = "|".join(sorted(input_hashes)) + "::" + (tool or "") + "::" + json.dumps(options or {}, sort_keys=True)
    if not settings.cache_cross_user and user_id:
        base += "::u=" + user_id
    return _NS + hashlib.sha256(base.encode()).hexdigest()


def _supa_headers() -> dict[str, str]:
    key = settings.supabase_service_role_key or ""
    return {"apikey": key, "Authorization": f"Bearer {key}"}


async def get(key: str) -> dict | None:
    try:
        if settings.cache_backend == "redis":
            raw = await redis_rest.get(key)
            return json.loads(raw) if raw else None
        if settings.cache_backend == "supabase":
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.get(
                    f"{settings.supabase_url}/rest/v1/conversion_cache",
                    params={
                        "key": f"eq.{key}",
                        "expires_at": f"gt.{datetime.now(timezone.utc).isoformat()}",
                        "select": "value",
                        "limit": "1",
                    },
                    headers=_supa_headers(),
                )
            rows = resp.json()
            return rows[0]["value"] if rows else None
    except Exception:  # noqa: BLE001 - cache must never break a request
        logger.warning("cache get failed", exc_info=True)
    return None


async def set(key: str, value: dict, ttl: int | None = None) -> None:
    ttl = ttl or settings.cache_ttl_seconds
    try:
        if settings.cache_backend == "redis":
            await redis_rest.setex(key, ttl, json.dumps(value))
        elif settings.cache_backend == "supabase":
            expires = (datetime.now(timezone.utc) + timedelta(seconds=ttl)).isoformat()
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                await client.post(
                    f"{settings.supabase_url}/rest/v1/conversion_cache",
                    params={"on_conflict": "key"},
                    headers={
                        **_supa_headers(),
                        "Content-Type": "application/json",
                        "Prefer": "resolution=merge-duplicates,return=minimal",
                    },
                    json={"key": key, "value": value, "expires_at": expires},
                )
    except Exception:  # noqa: BLE001
        logger.warning("cache set failed", exc_info=True)
