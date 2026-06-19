"""Razorpay payments — upgrade to a paid plan.

Flow: create-order → Razorpay Checkout (frontend) → verify signature → grant the
plan. A webhook provides a reliable backstop in case the browser callback is
lost. Razorpay is called over its REST API with httpx; signatures are verified
locally with HMAC-SHA256 (no SDK dependency).
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from app.config import settings
from app.core import email as email_mod, supa
from app.core.quota import require_user

logger = logging.getLogger("aio.payments")
router = APIRouter(prefix="/api/payments", tags=["payments"])

_RZP_API = "https://api.razorpay.com/v1"


class CreateOrderIn(BaseModel):
    plan: str  # "pro" | "business"


class VerifyIn(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    plan: str


def _auth_header() -> str:
    raw = f"{settings.razorpay_key_id}:{settings.razorpay_key_secret}".encode()
    return "Basic " + base64.b64encode(raw).decode()


def _verify_payment_signature(order_id: str, payment_id: str, signature: str) -> bool:
    secret = (settings.razorpay_key_secret or "").encode()
    expected = hmac.new(secret, f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature or "")


def _verify_webhook_signature(raw_body: bytes, signature: str) -> bool:
    secret = (settings.razorpay_webhook_secret or "").encode()
    if not secret:
        return False
    expected = hmac.new(secret, raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature or "")


async def _grant_plan(user_id: str, plan: str) -> str:
    # Each plan has its own validity window (Pro 30d · Business 365d).
    until = (datetime.now(timezone.utc) + timedelta(days=settings.plan_period_days(plan))).isoformat()
    await supa.set_plan(user_id, plan, until)
    return until


@router.get("/config")
def config() -> dict:
    """Public payment config for the checkout UI (key_id is publishable)."""
    return {
        "enabled": settings.razorpay_enabled,
        "key_id": settings.razorpay_key_id,
        "currency": settings.razorpay_currency,
        "period_days": settings.pro_period_days,
        "plans": {
            "pro": {"amount": settings.razorpay_pro_amount, "period_days": settings.pro_period_days},
            "business": {"amount": settings.razorpay_business_amount, "period_days": settings.business_period_days},
        },
    }


@router.post("/create-order")
async def create_order(body: CreateOrderIn, user: dict = Depends(require_user)) -> dict:
    if not settings.razorpay_enabled:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Payments are not configured yet.")
    amount = settings.plan_amount(body.plan)
    if amount is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown plan.")

    payload = {
        "amount": amount,
        "currency": settings.razorpay_currency,
        "receipt": f"u{user['id'][:8]}-{body.plan}",
        "notes": {"user_id": user["id"], "plan": body.plan},
    }
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                f"{_RZP_API}/orders",
                headers={"Authorization": _auth_header(), "Content-Type": "application/json"},
                json=payload,
            )
        resp.raise_for_status()
        order = resp.json()
    except Exception as exc:  # noqa: BLE001
        logger.warning("razorpay create order failed", exc_info=True)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Could not start checkout. Please try again.") from exc

    return {
        "order_id": order["id"],
        "amount": amount,
        "currency": settings.razorpay_currency,
        "key_id": settings.razorpay_key_id,
        "plan": body.plan,
        "email": user.get("email"),
    }


@router.post("/verify")
async def verify(body: VerifyIn, user: dict = Depends(require_user)) -> dict:
    if not _verify_payment_signature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Payment verification failed.")
    if settings.plan_amount(body.plan) is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown plan.")
    until = await _grant_plan(user["id"], body.plan)
    await email_mod.send_purchase_thankyou(user.get("email"), body.plan, until)
    return {"plan": body.plan, "until": until}


@router.post("/dev-upgrade")
async def dev_upgrade(body: CreateOrderIn, user: dict = Depends(require_user)) -> dict:
    """Development/testing shortcut: grant the plan to the signed-in user WITHOUT
    payment, but only while Razorpay is NOT configured. Once live keys are set
    this refuses (403), so it can't be abused in production.

    ⚠️ This means: deploy with no Razorpay keys = anyone signed in can self-grant
    Pro for free. Always set the keys before going live.
    """
    if settings.razorpay_enabled:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Payments are live — use checkout to upgrade."
        )
    if settings.plan_amount(body.plan) is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown plan.")
    until = await _grant_plan(user["id"], body.plan)
    await email_mod.send_purchase_thankyou(user.get("email"), body.plan, until)
    return {"plan": body.plan, "until": until, "dev": True}


@router.post("/webhook")
async def webhook(request: Request) -> dict:
    """Reliable server-side confirmation (configure in the Razorpay dashboard)."""
    raw = await request.body()
    signature = request.headers.get("x-razorpay-signature", "")
    if not _verify_webhook_signature(raw, signature):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid signature.")

    try:
        event = json.loads(raw)
    except Exception:  # noqa: BLE001
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid payload.")

    if event.get("event") in ("payment.captured", "order.paid"):
        entity = (
            (event.get("payload", {}).get("payment", {}) or {}).get("entity", {})
            or (event.get("payload", {}).get("order", {}) or {}).get("entity", {})
        )
        notes = entity.get("notes") or {}
        user_id = notes.get("user_id")
        plan = notes.get("plan", "pro")
        if user_id and settings.plan_amount(plan) is not None:
            try:
                until = await _grant_plan(user_id, plan)
                addr = await supa.user_email(user_id)
                await email_mod.send_purchase_thankyou(addr, plan, until)
            except Exception:  # noqa: BLE001 - webhook must still 200 so Razorpay won't spam retries
                logger.warning("webhook grant failed for %s", user_id, exc_info=True)
    return {"ok": True}
