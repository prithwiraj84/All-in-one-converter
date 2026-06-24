"""Tiny Upstash Redis REST client (httpx) — used by the cache + job store.

No SDK: Upstash exposes a REST API where you POST a command as a JSON array
(e.g. ["SET","k","v","EX","60"]) and get {"result": ...} back. Every call is
best-effort and returns None when Redis isn't configured or on error.
"""
from __future__ import annotations

import logging

import httpx

from app.config import settings

logger = logging.getLogger("aio.redis")
_TIMEOUT = httpx.Timeout(5.0)


def enabled() -> bool:
    return settings.redis_enabled


async def command(*args: object) -> object | None:
    if not settings.redis_enabled:
        return None
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(
                settings.upstash_redis_rest_url,
                headers={"Authorization": f"Bearer {settings.upstash_redis_rest_token}"},
                json=[str(a) for a in args],
            )
        resp.raise_for_status()
        return resp.json().get("result")
    except Exception:  # noqa: BLE001 - never let Redis break a request
        logger.warning("redis command failed: %s", args[0] if args else "?", exc_info=True)
        return None


async def get(key: str) -> str | None:
    val = await command("GET", key)
    return val if isinstance(val, str) else None


async def setex(key: str, ttl_seconds: int, value: str) -> bool:
    return (await command("SET", key, value, "EX", int(ttl_seconds))) is not None


async def set_value(key: str, value: str) -> bool:
    return (await command("SET", key, value)) is not None
