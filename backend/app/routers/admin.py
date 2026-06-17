"""Admin panel API.

Reachable only when ADMIN_PATH_TOKEN + ADMIN_PASSWORD are set. Every section
endpoint requires both as headers (X-Admin-Token / X-Admin-Password), validated
with constant-time comparison. When the panel is disabled, endpoints 404 to hide
its existence. `client-error` is intentionally public (the frontend posts JS
errors there) and rate-limited by the global limiter.
"""
from __future__ import annotations

import hmac

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.core import logbuffer, supa
from app.core.sysstats import system_stats

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _admin_ok(request: Request) -> bool:
    token = request.headers.get("x-admin-token") or ""
    pw = request.headers.get("x-admin-password") or ""
    return hmac.compare_digest(token, settings.admin_path_token or "") and hmac.compare_digest(
        pw, settings.admin_password or ""
    )


async def require_admin(request: Request) -> bool:
    if not settings.admin_enabled:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    if not _admin_ok(request):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid admin credentials.")
    return True


def _integrations() -> dict:
    return {
        "environment": settings.environment,
        "supabase": supa.is_configured(),
        "gemini": bool(settings.gemini_api_key),
        "anthropic": bool(settings.anthropic_api_key),
        "razorpay": settings.razorpay_enabled,
        "tesseract": True,  # bundled binaries in the image
    }


def _limits() -> dict:
    return {
        "max_concurrent_jobs": settings.max_concurrent_jobs,
        "max_concurrent_heavy": settings.max_concurrent_heavy,
        "job_queue_timeout_seconds": settings.job_queue_timeout_seconds,
        "rate_limit_per_minute": settings.rate_limit_per_minute,
        "retention_free_minutes": settings.file_retention_minutes,
        "retention_paid_minutes": settings.paid_retention_minutes,
        "whisper_model": settings.whisper_model,
        "max_upload_mb": settings.max_upload_mb,
    }


# ── Public: frontend error reporting ────────────────────────────────
class ClientError(BaseModel):
    message: str
    source: str | None = None
    level: str | None = "error"


@router.post("/client-error")
async def client_error(body: ClientError) -> dict:
    if settings.admin_enabled:  # only buffer when the panel can read it
        prefix = f"{body.source}: " if body.source else ""
        logbuffer.push_external(body.level or "error", "frontend", prefix + body.message)
    return {"ok": True}


# ── Admin-only sections ─────────────────────────────────────────────
@router.post("/login")
async def login(_: bool = Depends(require_admin)) -> dict:
    return {"ok": True}


@router.get("/overview")
async def overview(_: bool = Depends(require_admin)) -> dict:
    return {
        "stats": await supa.admin_overview(),
        "system": await run_in_threadpool(system_stats),
        "supabase_system": await supa.supabase_metrics(),
        "integrations": _integrations(),
        "limits": _limits(),
    }


@router.get("/users")
async def users(_: bool = Depends(require_admin), limit: int = 200) -> dict:
    return {"users": await supa.admin_users(limit=min(max(limit, 1), 1000))}


@router.get("/tools")
async def tools(_: bool = Depends(require_admin)) -> dict:
    return {"tools": await supa.admin_tool_usage()}


@router.get("/system")
async def system(_: bool = Depends(require_admin)) -> dict:
    return {
        "system": await run_in_threadpool(system_stats),
        "supabase_system": await supa.supabase_metrics(),
        "limits": _limits(),
        "integrations": _integrations(),
    }


@router.get("/logs")
async def logs(
    _: bool = Depends(require_admin),
    scope: str = "backend",
    level: str = "ALL",
    limit: int = 300,
) -> dict:
    return {"logs": logbuffer.recent_logs(limit=min(max(limit, 1), 600), level=level, scope=scope)}


@router.get("/hf-logs")
async def hf_logs(_: bool = Depends(require_admin), kind: str = "run") -> dict:
    from app.core import hf

    return await hf.space_logs(kind=kind)
