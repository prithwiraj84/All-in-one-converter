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
        params = {"id": f"eq.{user_id}", "select": "plan,pro_until", "limit": "1"}
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(url, headers=_rest_headers(), params=params)
        resp.raise_for_status()
        rows = resp.json()
        if not rows:
            return "free"
        plan = rows[0].get("plan") or "free"
        if plan != "free":
            until = rows[0].get("pro_until")
            if until:
                expires = datetime.fromisoformat(until.replace("Z", "+00:00"))
                if expires <= datetime.now(timezone.utc):
                    # Lapsed paid plan → revert to free (self-healing, best-effort).
                    await set_plan(user_id, "free", None)
                    return "free"
        return plan
    except Exception:
        logger.warning("get_plan failed; defaulting to free", exc_info=True)
    return "free"


async def set_plan(user_id: str, plan: str, pro_until_iso: str | None) -> None:
    """Authoritatively set a user's plan (profile + subscription). Service-role."""
    headers = {**_rest_headers(), "Content-Type": "application/json", "Prefer": "return=minimal"}
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            await client.patch(
                f"{settings.supabase_url}/rest/v1/profiles",
                headers=headers,
                params={"id": f"eq.{user_id}"},
                json={"plan": plan, "pro_until": pro_until_iso},
            )
            # Upsert the subscription row (unique on user_id).
            await client.post(
                f"{settings.supabase_url}/rest/v1/subscriptions",
                headers={**headers, "Prefer": "resolution=merge-duplicates,return=minimal"},
                params={"on_conflict": "user_id"},
                json={
                    "user_id": user_id,
                    "plan": plan,
                    "status": "active" if plan != "free" else "canceled",
                    "current_period_end": pro_until_iso,
                },
            )
    except Exception:
        logger.warning("set_plan failed", exc_info=True)
        raise


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


async def _count(client: httpx.AsyncClient, table: str, query: str = "") -> int | None:
    """Exact row count via PostgREST's Content-Range header."""
    try:
        url = f"{settings.supabase_url}/rest/v1/{table}?select=id{('&' + query) if query else ''}"
        headers = {**_rest_headers(), "Prefer": "count=exact", "Range": "0-0"}
        resp = await client.get(url, headers=headers)
        cr = resp.headers.get("content-range", "")
        if "/" in cr:
            total = cr.split("/")[-1]
            return int(total) if total.isdigit() else None
    except Exception:  # noqa: BLE001
        logger.warning("count(%s) failed", table, exc_info=True)
    return None


async def admin_overview() -> dict:
    """Top-line counts for the admin overview (best-effort; partial on error)."""
    out: dict = {"users": None, "plans": {}, "conversions": None, "conversions_today": None,
                 "files": None, "storage_used": None}
    if not is_configured():
        return out
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            today = start_of_utc_day_iso()
            out["users"] = await _count(client, "profiles")
            for plan in ("free", "pro", "business"):
                out["plans"][plan] = await _count(client, "profiles", f"plan=eq.{plan}")
            out["conversions"] = await _count(client, "conversions")
            out["conversions_today"] = await _count(client, "conversions", f"created_at=gte.{today}")
            out["files"] = await _count(client, "files")
            # Active storage (sum of non-expired file sizes), capped fetch.
            resp = await client.get(
                f"{settings.supabase_url}/rest/v1/files?select=size,expires_at&limit=20000",
                headers=_rest_headers(),
            )
            now = datetime.now(timezone.utc)
            total = 0
            for row in resp.json():
                exp = row.get("expires_at")
                if exp and datetime.fromisoformat(exp.replace("Z", "+00:00")) <= now:
                    continue
                total += int(row.get("size") or 0)
            out["storage_used"] = total
    except Exception:  # noqa: BLE001
        logger.warning("admin_overview failed", exc_info=True)
    return out


async def admin_users(limit: int = 200) -> list[dict]:
    """Recent users with their conversion counts."""
    if not is_configured():
        return []
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            pres = await client.get(
                f"{settings.supabase_url}/rest/v1/profiles"
                f"?select=id,email,name,plan,pro_until,created_at&order=created_at.desc&limit={limit}",
                headers=_rest_headers(),
            )
            users = pres.json()
            cres = await client.get(
                f"{settings.supabase_url}/rest/v1/conversions?select=user_id,created_at&limit=20000",
                headers=_rest_headers(),
            )
            counts: dict[str, int] = {}
            last: dict[str, str] = {}
            for row in cres.json():
                uid = row.get("user_id")
                if not uid:
                    continue
                counts[uid] = counts.get(uid, 0) + 1
                ts = row.get("created_at")
                if ts and ts > last.get(uid, ""):
                    last[uid] = ts
            for u in users:
                u["conversions"] = counts.get(u["id"], 0)
                u["last_active"] = last.get(u["id"])
            return users
    except Exception:  # noqa: BLE001
        logger.warning("admin_users failed", exc_info=True)
        return []


async def admin_tool_usage(limit_rows: int = 20000) -> list[dict]:
    """Usage count per tool (over the most recent `limit_rows` conversions)."""
    if not is_configured():
        return []
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(
                f"{settings.supabase_url}/rest/v1/conversions"
                f"?select=tool&order=created_at.desc&limit={limit_rows}",
                headers=_rest_headers(),
            )
            counts: dict[str, int] = {}
            for row in resp.json():
                t = row.get("tool") or "unknown"
                counts[t] = counts.get(t, 0) + 1
            return sorted(
                ({"tool": k, "uses": v} for k, v in counts.items()),
                key=lambda x: x["uses"],
                reverse=True,
            )
    except Exception:  # noqa: BLE001
        logger.warning("admin_tool_usage failed", exc_info=True)
        return []


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
