"""REST API key management (Business plan).

Signed-in Business users create/list/revoke API keys here (authenticated with
their Supabase session). The keys themselves are then used as
`Authorization: Bearer aio_live_…` on the processing endpoints — see
`enforce_quota`, which resolves the key to its owner and enforces Business-only
access. The full key is returned exactly once, at creation.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core import supa
from app.core.quota import require_business

router = APIRouter(prefix="/api/keys", tags=["api-keys"])


class CreateKeyIn(BaseModel):
    name: str | None = None


@router.get("")
async def list_keys(user: dict = Depends(require_business)) -> dict:
    return {"keys": await supa.list_api_keys(user["id"])}


@router.post("")
async def create_key(body: CreateKeyIn, user: dict = Depends(require_business)) -> dict:
    key = await supa.create_api_key(user["id"], body.name or "API key")
    if not key:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Could not create the key. Please try again.")
    return key  # includes the full `key` — shown to the user only this once


@router.delete("/{key_id}")
async def delete_key(key_id: str, user: dict = Depends(require_business)) -> dict:
    if not await supa.revoke_api_key(user["id"], key_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Key not found.")
    return {"ok": True}
