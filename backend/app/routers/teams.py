"""Team workspaces & roles (Business plan).

A Business owner gets one workspace and can invite members by email with a role
(admin / member). Members inherit the owner's Business access (resolved live via
`effective_plan` / `/api/me/plan`). The owner AND admins can manage the roster;
only the owner (who pays) can rename the team. Everyone can see the teams they
belong to.
"""
from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel

from app.core import email as email_mod, supa
from app.core.quota import require_user

router = APIRouter(prefix="/api/teams", tags=["teams"])


class RenameIn(BaseModel):
    name: str


class MemberIn(BaseModel):
    email: str
    role: str | None = "member"


class RoleIn(BaseModel):
    role: str


async def _managed_team(user: dict) -> tuple[str | None, bool]:
    """The team this user may manage, and whether they're the owner.
    Owner (pays) → their workspace; otherwise an active admin → that team."""
    uid = user["id"]
    if await supa.is_paying_owner(uid):
        team = await supa.get_or_create_team(uid)
        return (team["id"] if team else None, True)
    return (await supa.admin_membership_team(uid), False)


async def _require_managed(user: dict) -> str:
    team_id, _ = await _managed_team(user)
    if not team_id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only the team owner or an admin can manage members."
        )
    return team_id


@router.get("/me")
async def my_team(user: dict = Depends(require_user)) -> dict:
    """The workspace the user can manage (owner or admin) + teams they belong to."""
    team_id, is_owner = await _managed_team(user)
    managed = None
    if team_id:
        team = await supa.get_team(team_id)
        if team:
            managed = {"team": team, "members": await supa.list_team_members(team_id)}
    memberships = await supa.list_memberships(user["id"], user.get("email"))
    return {"managed": managed, "memberships": memberships, "is_owner": is_owner}


@router.patch("/me")
async def rename_team(body: RenameIn, user: dict = Depends(require_user)) -> dict:
    if not await supa.is_paying_owner(user["id"]):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the team owner can rename the team.")
    await supa.rename_team(user["id"], body.name)
    return {"ok": True}


@router.post("/members")
async def add_member(
    body: MemberIn, background: BackgroundTasks, user: dict = Depends(require_user)
) -> dict:
    team_id = await _require_managed(user)
    res = await supa.add_team_member(team_id, body.email, body.role or "member")
    if not res.get("ok"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, res.get("error", "Could not add the member."))
    team = await supa.get_team(team_id)
    # Send the invite AFTER responding (instant UX; access works regardless of email).
    background.add_task(
        email_mod.send_team_invite,
        body.email.strip().lower(),
        (team or {}).get("name") or "the team",
        user.get("email"),
    )
    return {**res, "queued": True}


@router.patch("/members/{member_id}")
async def set_member_role(member_id: str, body: RoleIn, user: dict = Depends(require_user)) -> dict:
    team_id = await _require_managed(user)
    if not await supa.update_team_member(team_id, member_id, body.role):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Could not update the role.")
    return {"ok": True}


@router.delete("/members/{member_id}")
async def remove_member(member_id: str, user: dict = Depends(require_user)) -> dict:
    team_id = await _require_managed(user)
    if not await supa.remove_team_member(team_id, member_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found.")
    return {"ok": True}
