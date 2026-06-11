"""Minimal async Supabase client (Auth + PostgREST) used for server-side
quota enforcement and authoritative conversion history.

Uses httpx directly (no supabase-py dependency). Every call is best-effort and
fail-open: network/parse errors raise or return safe defaults so a Supabase
outage never takes down the processing API. The only hard signal we trust is an
explicit 200 vs 401 from the Auth endpoint when validating a user token.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

import httpx

from app.config import settings

logger = logging.getLogger("aio.supa")

_TIMEOUT = httpx.Timeout(6.0)


def is_configured() -> bool:
    return bool(settings.supabase_url and settings.supabase_service_role_key)


def _rest_headers() -> dict[str, str]:
    key = settings.supabase_service_role_key or ""
    return {"apikey": key, "Authorization": f"Bearer {key}"}


def start_of_utc_day_iso() -> str:
    now = datetime.now(timezone.utc)
    return now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()


async def validate_token(token: str) -> dict | None:
    """Return the auth user for a Supabase access token, or None if the token
    is explicitly rejected (401/403). Raises on network errors so the caller can
    fail open instead of wrongly rejecting users during an outage.
    """
    url = f"{settings.supabase_url}/auth/v1/user"
    headers = {
        "apikey": settings.supabase_service_role_key or "",
        "Authorization": f"Bearer {token}",
    }
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.get(url, headers=headers)
    if resp.status_code == 200:
        data = resp.json()
        if data.get("id"):
            return data
        return None
    if resp.status_code in (401, 403):
        return None
    # Unexpected status — treat as "cannot determine"; raise to fail open.
    raise httpx.HTTPStatusError("unexpected auth status", request=resp.request, response=resp)


async def get_plan(user_id: str) -> str:
    try:
        url = f"{settings.supabase_url}/rest/v1/profiles"
        params = {"id": f"eq.{user_id}", "select": "plan", "limit": "1"}
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(url, headers=_rest_headers(), params=params)
        resp.raise_for_status()
        rows = resp.json()
        if rows and rows[0].get("plan"):
            return rows[0]["plan"]
    except Exception:
        logger.warning("get_plan failed; defaulting to free", exc_info=True)
    return "free"


async def count_tasks_today(user_id: str) -> int | None:
    """Conversions created since UTC midnight, or None if it can't be determined."""
    try:
        url = f"{settings.supabase_url}/rest/v1/conversions"
        params = {
            "user_id": f"eq.{user_id}",
            "created_at": f"gte.{start_of_utc_day_iso()}",
            "select": "id",
        }
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(url, headers=_rest_headers(), params=params)
        resp.raise_for_status()
        return len(resp.json())
    except Exception:
        logger.warning("count_tasks_today failed", exc_info=True)
        return None


async def storage_used(user_id: str) -> int | None:
    """Sum of non-expired output file sizes, or None if undeterminable."""
    try:
        url = f"{settings.supabase_url}/rest/v1/files"
        params = {"user_id": f"eq.{user_id}", "select": "size,expires_at"}
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(url, headers=_rest_headers(), params=params)
        resp.raise_for_status()
        now = datetime.now(timezone.utc)
        total = 0
        for row in resp.json():
            exp = row.get("expires_at")
            if exp and datetime.fromisoformat(exp.replace("Z", "+00:00")) <= now:
                continue
            total += int(row.get("size") or 0)
        return total
    except Exception:
        logger.warning("storage_used failed", exc_info=True)
        return None


async def record_conversion(
    user_id: str,
    *,
    tool: str,
    source_file: str | None,
    output_filename: str | None,
    output_size: int | None,
    download_url: str | None,
    mime: str | None,
    retention_minutes: int,
) -> None:
    """Insert the conversion (+ output file) rows. Best-effort."""
    from datetime import timedelta

    now = datetime.now(timezone.utc)
    headers = {**_rest_headers(), "Content-Type": "application/json", "Prefer": "return=minimal"}
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            await client.post(
                f"{settings.supabase_url}/rest/v1/conversions",
                headers=headers,
                json={
                    "user_id": user_id,
                    "tool": tool,
                    "source_file": source_file,
                    "output_file": output_filename,
                    "status": "completed",
                    "completed_at": now.isoformat(),
                },
            )
            if output_filename:
                await client.post(
                    f"{settings.supabase_url}/rest/v1/files",
                    headers=headers,
                    json={
                        "user_id": user_id,
                        "filename": output_filename,
                        "size": output_size or 0,
                        "type": mime,
                        "status": "ready",
                        "storage_path": download_url,
                        "expires_at": (now + timedelta(minutes=retention_minutes)).isoformat(),
                    },
                )
    except Exception:
        logger.warning("record_conversion failed", exc_info=True)
