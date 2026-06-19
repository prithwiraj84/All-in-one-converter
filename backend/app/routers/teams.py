"""Team workspaces & roles (Business plan).

A Business owner gets one workspace and can invite members by email with a role
(admin / member). Members inherit the owner's Business access (resolved in
`enforce_quota` via `effective_plan`/`team_plan_for`). Owners/admins manage the
roster; everyone can see the teams they belong to.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core import email as email_mod, supa
from app.core.quota import require_business_owner, require_user

router = APIRouter(prefix="/api/teams", tags=["teams"])


class RenameIn(BaseModel):
    name: str


class MemberIn(BaseModel):
    email: str
    role: str | None = "member"


class RoleIn(BaseModel):
    role: str


@router.get("/me")
async def my_team(user: dict = Depends(require_user)) -> dict:
    """The user's workspace (if they're a Business owner) + teams they belong to."""
    uid = user["id"]
    own_plan = await supa.get_plan(uid)
    owned = None
    if own_plan == "business":
        team = await supa.get_or_create_team(uid)
        if team:
            owned = {"team": team, "members": await supa.list_team_members(team["id"])}
    memberships = await supa.list_memberships(uid, user.get("email"))
    return {"owned": owned, "memberships": memberships, "is_business_owner": own_plan == "business"}


@router.patch("/me")
async def rename_team(body: RenameIn, user: dict = Depends(require_business_owner)) -> dict:
    await supa.rename_team(user["id"], body.name)
    return {"ok": True}


async def _owner_team_id(user: dict) -> str:
    team = await supa.get_or_create_team(user["id"])
    if not team:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Teams are unavailable right now.")
    return team["id"]


@router.post("/members")
async def add_member(body: MemberIn, user: dict = Depends(require_business_owner)) -> dict:
    team = await supa.get_or_create_team(user["id"])
    if not team:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Teams are unavailable right now.")
    res = await supa.add_team_member(team["id"], body.email, body.role or "member")
    if not res.get("ok"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, res.get("error", "Could not add the member."))
    # Send the invitation email (best-effort — access works regardless).
    emailed = await email_mod.send_team_invite(
        body.email.strip().lower(), team.get("name") or "the team", user.get("email")
    )
    return {**res, "emailed": emailed}


@router.patch("/members/{member_id}")
async def set_member_role(member_id: str, body: RoleIn, user: dict = Depends(require_business_owner)) -> dict:
    team_id = await _owner_team_id(user)
    if not await supa.update_team_member(team_id, member_id, body.role):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Could not update the role.")
    return {"ok": True}


@router.delete("/members/{member_id}")
async def remove_member(member_id: str, user: dict = Depends(require_business_owner)) -> dict:
    team_id = await _owner_team_id(user)
    if not await supa.remove_team_member(team_id, member_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found.")
    return {"ok": True}
