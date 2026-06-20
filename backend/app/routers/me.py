"""Current-user info — the authoritative *effective* plan.

The frontend reads this (not `profiles.plan` directly) so that a Free user who
belongs to a Business team correctly sees Business everywhere (badge, no ads,
limits, dashboard). `owner` distinguishes a paying owner from an inherited
member so billing/owner-only UI can be hidden for members.
"""
from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends

from app.core import email as email_mod, supa
from app.core.quota import require_user

router = APIRouter(prefix="/api/me", tags=["me"])


@router.get("/plan")
async def my_plan(user: dict = Depends(require_user)) -> dict:
    uid = user["id"]
    plan = await supa.effective_plan(uid, user.get("email"))
    owner = await supa.is_paying_owner(uid)
    pro_until = await supa.get_pro_until(uid) if owner else None
    return {"plan": plan, "owner": owner, "pro_until": pro_until}


@router.post("/welcome")
async def welcome(background: BackgroundTasks, user: dict = Depends(require_user)) -> dict:
    """Send the one-time welcome email (idempotent — safe to call on every login)."""
    uid = user["id"]
    if await supa.is_welcomed(uid):
        return {"sent": False}
    # Mark first to avoid a duplicate send if two sessions race; then email.
    await supa.mark_welcomed(uid)
    meta = user.get("user_metadata") or {}
    name = meta.get("full_name") or meta.get("name")
    background.add_task(email_mod.send_welcome, user.get("email"), name)
    return {"sent": True}
