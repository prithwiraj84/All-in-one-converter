"""Minimal async Supabase client (Auth + PostgREST) used for server-side
quota enforcement and authoritative conversion history.

Uses httpx directly (no supabase-py dependency). Every call is best-effort and
fail-open: network/parse errors raise or return safe defaults so a Supabase
outage never takes down the processing API. The only hard signal we trust is an
explicit 200 vs 401 from the Auth endpoint when validating a user token.
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone

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
                # Clear any prior renewal reminder so the new period can remind once.
                json={"plan": plan, "pro_until": pro_until_iso, "renewal_reminded_at": None},
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
    # Provision the owner's team workspace up front so even conversions made
    # before they open the Team tab are tagged into shared files (best-effort).
    if plan == "business":
        try:
            await get_or_create_team(user_id)
        except Exception:  # noqa: BLE001
            pass


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


async def supabase_metrics() -> dict | None:
    """Live Supabase project stats from its privileged Prometheus endpoint
    (Basic auth with the service-role key). Returns CPU(load)/RAM/disk/db size."""
    if not is_configured():
        return None
    url = f"{settings.supabase_url}/customer/v1/privileged/metrics"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, auth=("service_role", settings.supabase_service_role_key or ""))
        if resp.status_code != 200:
            return None
        lines = resp.text.splitlines()
    except Exception:  # noqa: BLE001
        logger.warning("supabase_metrics failed", exc_info=True)
        return None

    def value(metric: str, label: str | None = None) -> float | None:
        for line in lines:
            if not (line.startswith(metric + "{") or line.startswith(metric + " ")):
                continue
            if label and label not in line:
                continue
            try:
                return float(line.rsplit(" ", 1)[1])
            except (ValueError, IndexError):
                continue
        return None

    def occurrences(metric: str) -> int:
        return sum(1 for line in lines if line.startswith(metric + "{"))

    mem_total = value("node_memory_MemTotal_bytes")
    mem_avail = value("node_memory_MemAvailable_bytes")
    mem_used = mem_total - mem_avail if (mem_total and mem_avail is not None) else None
    fs_total = value("node_filesystem_size_bytes", 'mountpoint="/data"')
    fs_avail = value("node_filesystem_avail_bytes", 'mountpoint="/data"')
    fs_used = fs_total - fs_avail if (fs_total and fs_avail is not None) else None
    load1 = value("node_load1")
    cpus = occurrences("node_cpu_online") or 1

    return {
        "available": True,
        "cpus": cpus,
        "load1": load1,
        "cpu_percent": round(min(100.0, load1 / cpus * 100), 1) if load1 is not None else None,
        "memory_used": mem_used,
        "memory_total": mem_total,
        "memory_percent": round(mem_used / mem_total * 100, 1) if (mem_used and mem_total) else None,
        "disk_used": fs_used,
        "disk_total": fs_total,
        "disk_percent": round(fs_used / fs_total * 100, 1) if (fs_used and fs_total) else None,
        "db_size": value("pg_database_size_bytes"),
    }


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
    team_id: str | None = None,
) -> None:
    """Insert the conversion (+ output file) rows. Best-effort. When the user
    belongs to a team, both rows are tagged with `team_id` so the team can see
    the shared file (and the converter used)."""
    now = datetime.now(timezone.utc)
    headers = {**_rest_headers(), "Content-Type": "application/json", "Prefer": "return=minimal"}
    conv = {
        "user_id": user_id,
        "tool": tool,
        "source_file": source_file,
        "output_file": output_filename,
        "status": "completed",
        "completed_at": now.isoformat(),
    }
    file_row = {
        "user_id": user_id,
        "filename": output_filename,
        "size": output_size or 0,
        "type": mime,
        "status": "ready",
        "storage_path": download_url,
        "expires_at": (now + timedelta(minutes=retention_minutes)).isoformat(),
    }
    # Only add the team columns when there's a team — so a not-yet-migrated DB
    # never breaks normal (non-team) history recording.
    if team_id:
        conv["team_id"] = team_id
        file_row["team_id"] = team_id
        file_row["tool"] = tool
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            await client.post(f"{settings.supabase_url}/rest/v1/conversions", headers=headers, json=conv)
            if output_filename:
                await client.post(f"{settings.supabase_url}/rest/v1/files", headers=headers, json=file_row)
    except Exception:
        logger.warning("record_conversion failed", exc_info=True)


# ════════════════════════════════════════════════════════════════════════════
# REST API keys (Business plan)
# ════════════════════════════════════════════════════════════════════════════
API_KEY_PREFIX = "aio_live_"


def _hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def generate_api_key() -> tuple[str, str, str]:
    """Return (full_key, sha256_hash, display_prefix). The full key is shown once."""
    full = f"{API_KEY_PREFIX}{secrets.token_urlsafe(32)}"
    return full, _hash_key(full), full[: len(API_KEY_PREFIX) + 6] + "…"


async def create_api_key(user_id: str, name: str) -> dict | None:
    """Create a key. Returns {id, name, key (FULL — once), key_prefix, created_at}."""
    if not is_configured():
        return None
    full, key_hash, prefix = generate_api_key()
    headers = {**_rest_headers(), "Content-Type": "application/json", "Prefer": "return=representation"}
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(
                f"{settings.supabase_url}/rest/v1/api_keys",
                headers=headers,
                json={
                    "user_id": user_id,
                    "name": (name or "API key").strip()[:60] or "API key",
                    "key_hash": key_hash,
                    "key_prefix": prefix,
                },
            )
        resp.raise_for_status()
        row = resp.json()[0]
        return {"id": row["id"], "name": row["name"], "key": full, "key_prefix": prefix, "created_at": row["created_at"]}
    except Exception:
        logger.warning("create_api_key failed", exc_info=True)
        return None


async def list_api_keys(user_id: str) -> list[dict]:
    if not is_configured():
        return []
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(
                f"{settings.supabase_url}/rest/v1/api_keys",
                params={
                    "user_id": f"eq.{user_id}",
                    "revoked": "eq.false",
                    "select": "id,name,key_prefix,last_used_at,created_at",
                    "order": "created_at.desc",
                },
                headers=_rest_headers(),
            )
        resp.raise_for_status()
        return resp.json()
    except Exception:
        logger.warning("list_api_keys failed", exc_info=True)
        return []


async def revoke_api_key(user_id: str, key_id: str) -> bool:
    if not is_configured():
        return False
    headers = {**_rest_headers(), "Content-Type": "application/json", "Prefer": "return=minimal"}
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.patch(
                f"{settings.supabase_url}/rest/v1/api_keys",
                params={"id": f"eq.{key_id}", "user_id": f"eq.{user_id}"},
                headers=headers,
                json={"revoked": True},
            )
        return resp.status_code < 300
    except Exception:
        logger.warning("revoke_api_key failed", exc_info=True)
        return False


async def validate_api_key(raw_key: str) -> dict | None:
    """Resolve a raw API key to {id, user_id}, or None. Touches last_used (best-effort)."""
    if not is_configured() or not raw_key:
        return None
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(
                f"{settings.supabase_url}/rest/v1/api_keys",
                params={
                    "key_hash": f"eq.{_hash_key(raw_key)}",
                    "revoked": "eq.false",
                    "select": "id,user_id",
                    "limit": "1",
                },
                headers=_rest_headers(),
            )
            resp.raise_for_status()
            rows = resp.json()
            if not rows:
                return None
            row = rows[0]
            try:
                await client.patch(
                    f"{settings.supabase_url}/rest/v1/api_keys",
                    params={"id": f"eq.{row['id']}"},
                    headers={**_rest_headers(), "Content-Type": "application/json", "Prefer": "return=minimal"},
                    json={"last_used_at": datetime.now(timezone.utc).isoformat()},
                )
            except Exception:  # noqa: BLE001 - last_used is non-critical
                pass
            return {"id": row["id"], "user_id": row["user_id"]}
    except Exception:
        logger.warning("validate_api_key failed", exc_info=True)
        return None


# ════════════════════════════════════════════════════════════════════════════
# Team workspaces & roles (Business plan)
# ════════════════════════════════════════════════════════════════════════════
TEAM_MAX_MEMBERS = 25


async def _user_email(user_id: str) -> str | None:
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(
                f"{settings.supabase_url}/rest/v1/profiles",
                params={"id": f"eq.{user_id}", "select": "email", "limit": "1"},
                headers=_rest_headers(),
            )
        rows = resp.json()
        return rows[0]["email"] if rows else None
    except Exception:  # noqa: BLE001
        return None


async def user_email(user_id: str) -> str | None:
    """Public lookup of a user's email by id (or None)."""
    return await _user_email(user_id)


async def get_or_create_team(owner_id: str) -> dict | None:
    """The owner's workspace, created on first use."""
    if not is_configured():
        return None
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(
                f"{settings.supabase_url}/rest/v1/teams",
                params={"owner_id": f"eq.{owner_id}", "select": "id,name,owner_id,created_at", "limit": "1"},
                headers=_rest_headers(),
            )
            rows = resp.json()
            if rows:
                return rows[0]
            cres = await client.post(
                f"{settings.supabase_url}/rest/v1/teams",
                headers={**_rest_headers(), "Content-Type": "application/json", "Prefer": "return=representation"},
                json={"owner_id": owner_id, "name": "My team"},
            )
            cres.raise_for_status()
            return cres.json()[0]
    except Exception:
        logger.warning("get_or_create_team failed", exc_info=True)
        return None


async def rename_team(owner_id: str, name: str) -> bool:
    if not is_configured():
        return False
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.patch(
                f"{settings.supabase_url}/rest/v1/teams",
                params={"owner_id": f"eq.{owner_id}"},
                headers={**_rest_headers(), "Content-Type": "application/json", "Prefer": "return=minimal"},
                json={"name": (name or "My team").strip()[:60] or "My team"},
            )
        return resp.status_code < 300
    except Exception:
        logger.warning("rename_team failed", exc_info=True)
        return False


async def list_team_members(team_id: str) -> list[dict]:
    if not is_configured():
        return []
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(
                f"{settings.supabase_url}/rest/v1/team_members",
                params={
                    "team_id": f"eq.{team_id}",
                    "select": "id,email,role,status,created_at",
                    "order": "created_at.asc",
                },
                headers=_rest_headers(),
            )
        return resp.json()
    except Exception:
        logger.warning("list_team_members failed", exc_info=True)
        return []


async def add_team_member(team_id: str, email: str, role: str) -> dict:
    """Invite a member by email. Returns {ok: bool, error?: str, member?: dict}."""
    email = (email or "").strip().lower()
    role = role if role in ("admin", "member") else "member"
    if not email or "@" not in email:
        return {"ok": False, "error": "Enter a valid email address."}
    if not is_configured():
        return {"ok": False, "error": "Teams are not configured on this server."}
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            cur = await client.get(
                f"{settings.supabase_url}/rest/v1/team_members",
                params={"team_id": f"eq.{team_id}", "select": "id"},
                headers=_rest_headers(),
            )
            if len(cur.json()) >= TEAM_MAX_MEMBERS:
                return {"ok": False, "error": f"Team is full ({TEAM_MAX_MEMBERS} members max)."}
            resp = await client.post(
                f"{settings.supabase_url}/rest/v1/team_members",
                headers={**_rest_headers(), "Content-Type": "application/json", "Prefer": "return=representation"},
                json={"team_id": team_id, "email": email, "role": role, "status": "invited"},
            )
            if resp.status_code == 409:
                return {"ok": False, "error": "That email is already on the team."}
            resp.raise_for_status()
            return {"ok": True, "member": resp.json()[0]}
    except Exception:
        logger.warning("add_team_member failed", exc_info=True)
        return {"ok": False, "error": "Could not add the member. Please try again."}


async def update_team_member(team_id: str, member_id: str, role: str) -> bool:
    if role not in ("admin", "member") or not is_configured():
        return False
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.patch(
                f"{settings.supabase_url}/rest/v1/team_members",
                params={"id": f"eq.{member_id}", "team_id": f"eq.{team_id}"},
                headers={**_rest_headers(), "Content-Type": "application/json", "Prefer": "return=minimal"},
                json={"role": role},
            )
        return resp.status_code < 300
    except Exception:
        logger.warning("update_team_member failed", exc_info=True)
        return False


async def remove_team_member(team_id: str, member_id: str) -> bool:
    if not is_configured():
        return False
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.delete(
                f"{settings.supabase_url}/rest/v1/team_members",
                params={"id": f"eq.{member_id}", "team_id": f"eq.{team_id}"},
                headers=_rest_headers(),
            )
        return resp.status_code < 300
    except Exception:
        logger.warning("remove_team_member failed", exc_info=True)
        return False


async def team_plan_for(user_id: str, email: str | None) -> str | None:
    """Return 'business' if the user is a member of a team whose owner has an
    active Business plan (so members inherit Business). Best-effort; activates
    the member's row (backfills user_id) on first successful match."""
    if not is_configured():
        return None
    try:
        if email is None:
            email = await _user_email(user_id)
        email = (email or "").lower() or None
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            members: list[dict] = []
            r1 = await client.get(
                f"{settings.supabase_url}/rest/v1/team_members",
                params={"user_id": f"eq.{user_id}", "select": "id,team_id"},
                headers=_rest_headers(),
            )
            members += r1.json()
            if email:
                r2 = await client.get(
                    f"{settings.supabase_url}/rest/v1/team_members",
                    params={"email": f"eq.{email}", "select": "id,team_id"},
                    headers=_rest_headers(),
                )
                members += r2.json()
            if not members:
                return None
            team_ids = list({m["team_id"] for m in members})
            tres = await client.get(
                f"{settings.supabase_url}/rest/v1/teams",
                params={"id": f"in.({','.join(team_ids)})", "select": "owner_id"},
                headers=_rest_headers(),
            )
            owner_ids = list({t["owner_id"] for t in tres.json()})
            if not owner_ids:
                return None
            pres = await client.get(
                f"{settings.supabase_url}/rest/v1/profiles",
                params={"id": f"in.({','.join(owner_ids)})", "plan": "eq.business", "select": "pro_until"},
                headers=_rest_headers(),
            )
            now = datetime.now(timezone.utc)
            business = False
            for p in pres.json():
                until = p.get("pro_until")
                if not until:
                    business = True
                    break
                try:
                    if datetime.fromisoformat(until.replace("Z", "+00:00")) > now:
                        business = True
                        break
                except Exception:  # noqa: BLE001
                    business = True
                    break
            if not business:
                return None
            if email:  # accept the invite: bind user_id + activate
                try:
                    await client.patch(
                        f"{settings.supabase_url}/rest/v1/team_members",
                        params={"email": f"eq.{email}"},
                        headers={**_rest_headers(), "Content-Type": "application/json", "Prefer": "return=minimal"},
                        json={"user_id": user_id, "status": "active"},
                    )
                except Exception:  # noqa: BLE001
                    pass
            return "business"
    except Exception:
        logger.warning("team_plan_for failed", exc_info=True)
        return None


async def effective_plan(user_id: str, email: str | None = None) -> str:
    """The user's own plan, upgraded to 'business' if they're on a Business team."""
    plan = await get_plan(user_id)
    if plan != "free":
        return plan
    return (await team_plan_for(user_id, email)) or "free"


async def is_paying_owner(user_id: str) -> bool:
    """True if the user has their OWN active paid subscription (i.e. they pay) —
    distinguishes a real owner from a member who only inherits Business access."""
    if not is_configured():
        return False
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(
                f"{settings.supabase_url}/rest/v1/subscriptions",
                params={
                    "user_id": f"eq.{user_id}",
                    "plan": "neq.free",
                    "status": "eq.active",
                    "select": "plan",
                    "limit": "1",
                },
                headers=_rest_headers(),
            )
        return bool(resp.json())
    except Exception:  # noqa: BLE001
        logger.warning("is_paying_owner failed", exc_info=True)
        return False


async def is_welcomed(user_id: str) -> bool:
    """True if the one-time welcome email was already sent (welcomed_at set).
    Fails CLOSED (returns True) on error so we never spam duplicate welcomes."""
    if not is_configured():
        return True
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(
                f"{settings.supabase_url}/rest/v1/profiles",
                params={"id": f"eq.{user_id}", "select": "welcomed_at", "limit": "1"},
                headers=_rest_headers(),
            )
        rows = resp.json()
        return bool(rows and rows[0].get("welcomed_at"))
    except Exception:  # noqa: BLE001
        logger.warning("is_welcomed failed", exc_info=True)
        return True


async def mark_welcomed(user_id: str) -> None:
    if not is_configured():
        return
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            await client.patch(
                f"{settings.supabase_url}/rest/v1/profiles",
                params={"id": f"eq.{user_id}"},
                headers={**_rest_headers(), "Content-Type": "application/json", "Prefer": "return=minimal"},
                json={"welcomed_at": datetime.now(timezone.utc).isoformat()},
            )
    except Exception:  # noqa: BLE001
        logger.warning("mark_welcomed failed", exc_info=True)


async def get_pro_until(user_id: str) -> str | None:
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(
                f"{settings.supabase_url}/rest/v1/profiles",
                params={"id": f"eq.{user_id}", "select": "pro_until", "limit": "1"},
                headers=_rest_headers(),
            )
        rows = resp.json()
        return rows[0].get("pro_until") if rows else None
    except Exception:  # noqa: BLE001
        return None


async def get_team(team_id: str) -> dict | None:
    if not is_configured():
        return None
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(
                f"{settings.supabase_url}/rest/v1/teams",
                params={"id": f"eq.{team_id}", "select": "id,name,owner_id,created_at", "limit": "1"},
                headers=_rest_headers(),
            )
        rows = resp.json()
        return rows[0] if rows else None
    except Exception:  # noqa: BLE001
        logger.warning("get_team failed", exc_info=True)
        return None


async def admin_membership_team(user_id: str) -> str | None:
    """team_id of a team where the user is an ACTIVE admin member (or None)."""
    if not is_configured():
        return None
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(
                f"{settings.supabase_url}/rest/v1/team_members",
                params={
                    "user_id": f"eq.{user_id}",
                    "role": "eq.admin",
                    "status": "eq.active",
                    "select": "team_id",
                    "limit": "1",
                },
                headers=_rest_headers(),
            )
        rows = resp.json()
        return rows[0]["team_id"] if rows else None
    except Exception:  # noqa: BLE001
        logger.warning("admin_membership_team failed", exc_info=True)
        return None


async def user_team_id(user_id: str) -> str | None:
    """The team this user belongs to — their owned workspace, else a team they're
    a member of. Used to tag conversions/files for the shared team files view."""
    if not is_configured() or not user_id:
        return None
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            owned = await client.get(
                f"{settings.supabase_url}/rest/v1/teams",
                params={"owner_id": f"eq.{user_id}", "select": "id", "limit": "1"},
                headers=_rest_headers(),
            )
            rows = owned.json()
            if rows:
                return rows[0]["id"]
            mem = await client.get(
                f"{settings.supabase_url}/rest/v1/team_members",
                params={"user_id": f"eq.{user_id}", "select": "team_id", "limit": "1"},
                headers=_rest_headers(),
            )
            mrows = mem.json()
            return mrows[0]["team_id"] if mrows else None
    except Exception:  # noqa: BLE001
        return None


async def team_files(team_id: str, limit: int = 100) -> list[dict]:
    """Non-expired output files shared across a team, enriched with the converter
    (tool) and the member's email. Powers the shared 'Team files' view."""
    if not is_configured() or not team_id:
        return []
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(
                f"{settings.supabase_url}/rest/v1/files",
                params={
                    "team_id": f"eq.{team_id}",
                    "select": "id,filename,size,type,tool,storage_path,created_at,expires_at,user_id",
                    "order": "created_at.desc",
                    "limit": str(min(max(limit, 1), 300)),
                },
                headers=_rest_headers(),
            )
            rows = resp.json()
            now = datetime.now(timezone.utc)
            active = []
            for r in rows:
                exp = r.get("expires_at")
                if exp and datetime.fromisoformat(exp.replace("Z", "+00:00")) <= now:
                    continue
                active.append(r)
            uids = list({r["user_id"] for r in active if r.get("user_id")})
            emails: dict[str, str | None] = {}
            if uids:
                pres = await client.get(
                    f"{settings.supabase_url}/rest/v1/profiles",
                    params={"id": f"in.({','.join(uids)})", "select": "id,email"},
                    headers=_rest_headers(),
                )
                emails = {p["id"]: p.get("email") for p in pres.json()}
            for r in active:
                r["member_email"] = emails.get(r.get("user_id"))
            return active
    except Exception:  # noqa: BLE001
        logger.warning("team_files failed", exc_info=True)
        return []


async def record_api_request(user_id: str, key_id: str | None, tool: str | None, status_code: int) -> None:
    """Log one REST-API request for usage analytics. Best-effort."""
    if not is_configured() or not user_id:
        return
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            await client.post(
                f"{settings.supabase_url}/rest/v1/api_requests",
                headers={**_rest_headers(), "Content-Type": "application/json", "Prefer": "return=minimal"},
                json={"user_id": user_id, "key_id": key_id, "tool": tool, "status": int(status_code)},
            )
    except Exception:  # noqa: BLE001
        logger.warning("record_api_request failed", exc_info=True)


# Strong refs so fire-and-forget logging tasks aren't GC'd before they run
# (the event loop only keeps a weak reference to bare create_task tasks).
_bg_tasks: set = set()


def log_api_request_bg(user_id: str | None, key_id: str | None, tool: str | None, status_code: int) -> None:
    """Fire-and-forget API-request logging that won't slow the response and won't
    be garbage-collected mid-flight."""
    if not user_id:
        return
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:  # no running loop (e.g. sync test context)
        return
    task = loop.create_task(record_api_request(user_id, key_id, tool, status_code))
    _bg_tasks.add(task)
    task.add_done_callback(_bg_tasks.discard)


async def api_usage_stats(user_id: str, days: int = 30) -> dict:
    """Aggregate REST-API usage for a user over the last `days`: totals, errors,
    success rate, peak RPM/RPD, and per-tool / per-key breakdowns."""
    from collections import Counter

    empty = {
        "total": 0, "errors": 0, "success_rate": 1.0, "peak_rpm": 0, "peak_rpd": 0,
        "per_tool": [], "per_key": [], "days": days,
    }
    if not is_configured():
        return empty
    try:
        since = (datetime.now(timezone.utc) - timedelta(days=max(1, days))).isoformat()
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(
                f"{settings.supabase_url}/rest/v1/api_requests",
                params={
                    "user_id": f"eq.{user_id}",
                    "created_at": f"gte.{since}",
                    "select": "tool,status,key_id,created_at",
                    "order": "created_at.desc",
                    "limit": "50000",
                },
                headers=_rest_headers(),
            )
            rows = resp.json()
        total = len(rows)
        if total == 0:
            return empty
        errors = sum(1 for r in rows if int(r.get("status") or 0) >= 400)
        tool_c = Counter((r.get("tool") or "unknown") for r in rows)
        key_c = Counter((r.get("key_id") or "") for r in rows)
        minute_c = Counter((r.get("created_at") or "")[:16] for r in rows)  # YYYY-MM-DDTHH:MM
        day_c = Counter((r.get("created_at") or "")[:10] for r in rows)     # YYYY-MM-DD

        names: dict[str, str] = {}
        key_ids = [k for k in key_c if k]
        if key_ids:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                kres = await client.get(
                    f"{settings.supabase_url}/rest/v1/api_keys",
                    params={"id": f"in.({','.join(key_ids)})", "select": "id,name,key_prefix"},
                    headers=_rest_headers(),
                )
                names = {k["id"]: (k.get("name") or k.get("key_prefix") or "key") for k in kres.json()}

        per_key = sorted(
            ({"name": names.get(k) or ("Deleted key" if k else "Unknown"), "count": v} for k, v in key_c.items()),
            key=lambda x: x["count"], reverse=True,
        )
        per_tool = sorted(
            ({"tool": t, "count": v} for t, v in tool_c.items()), key=lambda x: x["count"], reverse=True
        )
        return {
            "total": total,
            "errors": errors,
            "success_rate": round((total - errors) / total, 4),
            "peak_rpm": max(minute_c.values()),
            "peak_rpd": max(day_c.values()),
            "per_tool": per_tool[:20],
            "per_key": per_key[:20],
            "days": days,
        }
    except Exception:  # noqa: BLE001
        logger.warning("api_usage_stats failed", exc_info=True)
        return empty


async def expiring_profiles(days: int) -> list[dict]:
    """Paid profiles whose plan lapses within `days` and that haven't been
    reminded yet (renewal_reminded_at is null). Returns id, email, plan, pro_until."""
    if not is_configured():
        return []
    now = datetime.now(timezone.utc)
    until = now.replace(microsecond=0)
    horizon = (now + timedelta(days=max(1, days))).replace(microsecond=0)
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(
                f"{settings.supabase_url}/rest/v1/profiles",
                params={
                    "plan": "neq.free",
                    "pro_until": [f"gte.{until.isoformat()}", f"lte.{horizon.isoformat()}"],
                    "renewal_reminded_at": "is.null",
                    "select": "id,email,plan,pro_until",
                    "limit": "500",
                },
                headers=_rest_headers(),
            )
        resp.raise_for_status()
        return resp.json()
    except Exception:  # noqa: BLE001
        logger.warning("expiring_profiles failed", exc_info=True)
        return []


async def mark_reminded(user_id: str) -> None:
    if not is_configured():
        return
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            await client.patch(
                f"{settings.supabase_url}/rest/v1/profiles",
                params={"id": f"eq.{user_id}"},
                headers={**_rest_headers(), "Content-Type": "application/json", "Prefer": "return=minimal"},
                json={"renewal_reminded_at": datetime.now(timezone.utc).isoformat()},
            )
    except Exception:  # noqa: BLE001
        logger.warning("mark_reminded failed", exc_info=True)


async def send_invite_email(email: str) -> bool:
    """Send Supabase's built-in invite email (admin endpoint, service-role).
    Returns False if the address already has an account or Supabase rejects it
    — the caller treats email as best-effort."""
    if not is_configured():
        return False
    key = settings.supabase_service_role_key or ""
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    params = {"redirect_to": f"{settings.app_url.rstrip('/')}/login"}
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(
                f"{settings.supabase_url}/auth/v1/invite",
                headers=headers,
                params=params,
                json={"email": email},
            )
        return resp.status_code < 300
    except Exception:  # noqa: BLE001
        logger.warning("send_invite_email failed", exc_info=True)
        return False


async def list_memberships(user_id: str, email: str | None) -> list[dict]:
    """Teams the user belongs to (not as owner) — for the dashboard 'Team' view."""
    if not is_configured():
        return []
    try:
        email = (email or "").lower() or None
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            rows: list[dict] = []
            r1 = await client.get(
                f"{settings.supabase_url}/rest/v1/team_members",
                params={"user_id": f"eq.{user_id}", "select": "team_id,role,status"},
                headers=_rest_headers(),
            )
            rows += r1.json()
            if email:
                r2 = await client.get(
                    f"{settings.supabase_url}/rest/v1/team_members",
                    params={"email": f"eq.{email}", "select": "team_id,role,status"},
                    headers=_rest_headers(),
                )
                rows += r2.json()
            if not rows:
                return []
            by_team = {r["team_id"]: r for r in rows}
            tres = await client.get(
                f"{settings.supabase_url}/rest/v1/teams",
                params={"id": f"in.({','.join(by_team)})", "select": "id,name,owner_id"},
                headers=_rest_headers(),
            )
            out = []
            for t in tres.json():
                m = by_team.get(t["id"], {})
                out.append({"team_id": t["id"], "team_name": t["name"], "role": m.get("role"), "status": m.get("status")})
            return out
    except Exception:
        logger.warning("list_memberships failed", exc_info=True)
        return []
