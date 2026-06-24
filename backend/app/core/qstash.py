"""Upstash QStash client: publish a job to the queue and verify the signed
webhook QStash sends back to our worker. Off unless QSTASH_TOKEN +
BACKEND_PUBLIC_URL are set — until then the app runs every job synchronously."""
from __future__ import annotations

import base64
import hashlib
import logging

import httpx

from app.config import settings

logger = logging.getLogger("aio.qstash")

_PUBLISH = "https://qstash.upstash.io/v2/publish/"


def enabled() -> bool:
    return settings.qstash_enabled


async def publish_json(target_url: str, body: dict, *, retries: int = 3) -> bool:
    """Enqueue a message; QStash will POST `body` to `target_url` (with retries).
    Returns True on accept. Best-effort — caller falls back to sync on False."""
    if not settings.qstash_token:
        return False
    headers = {
        "Authorization": f"Bearer {settings.qstash_token}",
        "Content-Type": "application/json",
        "Upstash-Retries": str(retries),
    }
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(15.0)) as client:
            resp = await client.post(_PUBLISH + target_url, headers=headers, json=body)
        if resp.status_code < 300:
            return True
        logger.warning("qstash publish rejected: %s %s", resp.status_code, resp.text[:200])
    except Exception:  # noqa: BLE001
        logger.warning("qstash publish failed", exc_info=True)
    return False


def _b64url_nopad(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def verify_signature(token: str | None, raw_body: bytes) -> bool:
    """Verify the `Upstash-Signature` JWT against the raw request body, trying the
    current then the next signing key (QStash rotates them). The JWT's `body`
    claim is base64url(sha256(rawBody))."""
    if not token:
        return False
    try:
        import jwt  # PyJWT
    except ImportError:
        logger.error("PyJWT not installed — cannot verify QStash signatures")
        return False

    digest = hashlib.sha256(raw_body).digest()
    expected = {
        _b64url_nopad(digest),
        base64.b64encode(digest).decode().rstrip("="),
    }
    for key in (settings.qstash_current_signing_key, settings.qstash_next_signing_key):
        if not key:
            continue
        try:
            claims = jwt.decode(
                token, key, algorithms=["HS256"],
                options={"verify_aud": False, "verify_iss": False},
            )
        except Exception:  # noqa: BLE001 - try the next key
            continue
        body_claim = (claims.get("body") or "").rstrip("=")
        if body_claim and body_claim in expected:
            return True
        logger.warning("qstash body-hash mismatch")
    return False
