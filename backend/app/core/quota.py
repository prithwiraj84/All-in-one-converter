"""Server-side plan limits and per-user quota enforcement.

`enforce_quota` is attached to every processing router. It authenticates the
Supabase bearer token, resolves the user's plan, and rejects requests that
exceed the daily task or storage quota. The resolved context is stashed in a
ContextVar so `run_job` can apply the per-file size cap and record the
conversion authoritatively without threading the request through every endpoint.

Fail-open by design: if Supabase is unreachable or a usage query fails, the
request is allowed (never a 500) — the only hard rejections are an explicitly
invalid token (401), a confirmed over-quota count (429), or confirmed
over-storage (413).
"""
from __future__ import annotations

import contextvars
import logging
import os
from dataclasses import dataclass

import httpx
from fastapi import HTTPException, Request, status

from app.config import settings
from app.core import supa

logger = logging.getLogger("aio.quota")

_MB = 1024 * 1024
_GB = 1024 * _MB


@dataclass(frozen=True)
class PlanLimits:
    label: str
    storage_bytes: int
    max_file_bytes: int
    daily_tasks: float  # inf = unlimited


PLAN_LIMITS: dict[str, PlanLimits] = {
    "free": PlanLimits("Free", 100 * _MB, 10 * _MB, 5),
    "pro": PlanLimits("Pro", 2 * _GB, 1 * _GB, float("inf")),
    "business": PlanLimits("Business", 20 * _GB, 5 * _GB, float("inf")),
}


def plan_limits(plan: str | None) -> PlanLimits:
    return PLAN_LIMITS.get(plan or "free", PLAN_LIMITS["free"])


def retention_minutes_for(plan: str | None) -> int:
    """How long a plan's output files are kept before auto-deletion."""
    return settings.file_retention_minutes if (plan or "free") == "free" else settings.paid_retention_minutes


@dataclass
class QuotaContext:
    user_id: str | None
    plan: str
    limits: PlanLimits
    tool: str | None
    progress_id: str | None = None


_quota_ctx: contextvars.ContextVar[QuotaContext | None] = contextvars.ContextVar(
    "quota_ctx", default=None
)


def current_quota() -> QuotaContext | None:
    return _quota_ctx.get()


def fmt_bytes(n: float) -> str:
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if n < 1024 or unit == "TB":
            return f"{n:.0f} {unit}" if unit == "B" else f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} TB"


def _bearer(request: Request) -> str | None:
    header = request.headers.get("authorization") or ""
    if header.lower().startswith("bearer "):
        return header[7:].strip() or None
    return None


async def require_user(request: Request) -> dict:
    """Dependency for endpoints that require a signed-in user (e.g. payments)."""
    token = _bearer(request)
    if not token or not supa.is_configured():
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Please sign in to continue.")
    try:
        user = await supa.validate_token(token)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Authentication is temporarily unavailable. Please try again."
        ) from exc
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Your session has expired. Please sign in again.")
    return user


async def enforce_quota(request: Request) -> QuotaContext:
    """FastAPI dependency: authenticate + enforce per-user quotas."""
    token = _bearer(request)
    tool = request.headers.get("x-tool-slug")
    # Client-generated id used only to stream this job's progress (not a secret).
    pid = (request.headers.get("x-job-id") or "")[:64].strip() or None

    # Anonymous, or Supabase not wired up → Free limits, no per-user tracking.
    if not token or not supa.is_configured():
        ctx = QuotaContext(None, "free", plan_limits("free"), tool, pid)
        _quota_ctx.set(ctx)
        return ctx

    # Authenticate. Fail open on outage; only reject a definitively invalid token.
    try:
        user = await supa.validate_token(token)
    except (httpx.HTTPError, Exception):  # noqa: BLE001 - never 500 on auth
        logger.warning("token validation unavailable; allowing as anonymous", exc_info=True)
        ctx = QuotaContext(None, "free", plan_limits("free"), tool, pid)
        _quota_ctx.set(ctx)
        return ctx

    if user is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Your session is invalid or has expired. Please sign in again.",
        )

    user_id = user["id"]
    plan = await supa.get_plan(user_id)
    limits = plan_limits(plan)
    ctx = QuotaContext(user_id, plan, limits, tool, pid)
    _quota_ctx.set(ctx)

    # Daily task limit — only reject on a confirmed count.
    if limits.daily_tasks != float("inf"):
        used = await supa.count_tasks_today(user_id)
        if used is not None and used >= limits.daily_tasks:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                f"Daily limit reached: {int(limits.daily_tasks)} tasks/day on the "
                f"{limits.label} plan. Upgrade to Pro for unlimited.",
            )

    # Storage limit — coarse upper bound from Content-Length; only reject on a
    # confirmed current usage figure.
    used_storage = await supa.storage_used(user_id)
    if used_storage is not None:
        incoming = int(request.headers.get("content-length") or 0)
        if used_storage + incoming > limits.storage_bytes:
            raise HTTPException(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                f"Storage limit reached ({fmt_bytes(limits.storage_bytes)} on the "
                f"{limits.label} plan). Files auto-delete after "
                f"{settings.file_retention_minutes} minutes, or upgrade to Pro.",
            )

    return ctx


# ── MIME guess for recorded output files ────────────────────────────
_MIME_BY_EXT = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".txt": "text/plain",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".zip": "application/zip",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
}


def guess_mime(filename: str | None) -> str | None:
    if not filename:
        return None
    return _MIME_BY_EXT.get(os.path.splitext(filename)[1].lower(), "application/octet-stream")
