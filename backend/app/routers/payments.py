"""Razorpay payments — buy or renew a paid plan.

Flow: create-order → Razorpay Checkout (frontend) → verify → grant the plan. The
webhook is a server-side backstop for when the browser callback is lost. Every
grant is confirmed against Razorpay's API — the order's notes (set by us at
create-order) decide the user + plan, the payment must cover the full order, and
authorized-only payments are captured — then recorded in the `payments` ledger so
the callback and the webhook never grant the same payment twice.

Razorpay is called over its REST API with httpx; signatures are verified locally
with HMAC-SHA256 (no SDK dependency).
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from pydantic import BaseModel

from app.config import settings
from app.core import email as email_mod, supa
from app.core.quota import require_user

logger = logging.getLogger("aio.payments")
router = APIRouter(prefix="/api/payments", tags=["payments"])

_RZP_API = "https://api.razorpay.com/v1"
# Subscribe the Razorpay webhook to these; duplicates are deduped by the ledger.
_WEBHOOK_EVENTS = ("payment.authorized", "payment.captured", "order.paid")


class CreateOrderIn(BaseModel):
    plan: str  # "pro" | "business"


class VerifyIn(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    plan: str | None = None  # informational only — the order's notes decide the plan


def _auth_header() -> str:
    raw = f"{settings.razorpay_key_id}:{settings.razorpay_key_secret}".encode()
    return "Basic " + base64.b64encode(raw).decode()


def _dev_mode() -> bool:
    """Free self-upgrades for local testing: explicit opt-in, and only without keys."""
    return settings.payments_dev_mode and not settings.razorpay_enabled


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


async def _rzp(method: str, path: str, **kwargs) -> dict:
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.request(
            method, f"{_RZP_API}{path}", headers={"Authorization": _auth_header()}, **kwargs
        )
    resp.raise_for_status()
    return resp.json()


async def _settle(payment_id: str, order_id: str | None = None) -> dict | None:
    """Confirm a payment with Razorpay, capturing it if it's only authorized.
    Returns the fulfilment details, or None if it isn't a fully paid plan order
    of ours. Raises httpx errors when Razorpay can't be reached."""
    payment = await _rzp("GET", f"/payments/{payment_id}")
    if not payment.get("order_id") or (order_id and payment["order_id"] != order_id):
        return None
    order = await _rzp("GET", f"/orders/{payment['order_id']}")
    notes = order.get("notes") if isinstance(order.get("notes"), dict) else {}
    user_id, plan = notes.get("user_id"), notes.get("plan")
    if not user_id or settings.plan_amount(plan or "") is None or payment.get("amount") != order.get("amount"):
        logger.warning("payment %s does not match a plan order", payment_id)
        return None

    if payment.get("status") == "authorized":
        try:
            payment = await _rzp(
                "POST", f"/payments/{payment_id}/capture",
                json={"amount": payment["amount"], "currency": payment["currency"]},
            )
        except httpx.HTTPStatusError:
            # Most likely captured concurrently (callback + webhook) — re-check.
            payment = await _rzp("GET", f"/payments/{payment_id}")
    if payment.get("status") != "captured":
        return None

    ts = payment.get("created_at")
    return {
        "payment_id": payment_id,
        "order_id": order["id"],
        "user_id": user_id,
        "plan": plan,
        "amount": payment["amount"],
        "currency": payment["currency"],
        "paid_at": datetime.fromtimestamp(ts, timezone.utc) if ts else datetime.now(timezone.utc),
    }


async def _current_until(user_id: str, plan: str) -> datetime | None:
    """Expiry of the user's own active plan, if it's the same plan being bought."""
    if await supa.get_plan(user_id) != plan:
        return None
    raw = await supa.get_pro_until(user_id)
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")) if raw else None
    except ValueError:
        return None


async def _grant_plan(
    user_id: str, plan: str, *, paid_at: datetime | None = None, stack: bool = False
) -> str:
    """Activate `plan` for its validity window. With `stack` (a payment the ledger
    confirmed is new), renewing the same plan early adds onto the remaining days.
    Without it the window is anchored to the payment time and never shortens an
    existing one, so re-processing the same payment can't extend access."""
    start = paid_at or datetime.now(timezone.utc)
    current = await _current_until(user_id, plan)
    if stack and current and current > start:
        start = current
    until = start + timedelta(days=settings.plan_period_days(plan))
    if current and current > until:
        until = current
    await supa.set_plan(user_id, plan, until.isoformat())
    return until.isoformat()


async def _fulfil(paid: dict) -> tuple[str, bool]:
    """Grant the plan for a settled payment exactly once.
    Returns (valid-until ISO, whether this call granted it)."""
    fresh = await supa.record_payment(paid)
    if fresh is False:  # already fulfilled (checkout callback and webhook both arrive)
        return (await supa.get_pro_until(paid["user_id"])) or "", False
    try:
        until = await _grant_plan(paid["user_id"], paid["plan"], paid_at=paid["paid_at"], stack=bool(fresh))
    except Exception:
        if fresh:
            await supa.delete_payment(paid["payment_id"])  # let a retry fulfil it
        raise
    return until, True


async def _notify_purchase(
    user_id: str, plan: str, until: str, amount: int | None = None, order_id: str | None = None
) -> None:
    """Look up the buyer's email and send the thank-you (used by the webhook)."""
    addr = await supa.user_email(user_id)
    if addr:
        await email_mod.send_purchase_thankyou(
            addr, plan, until, amount=amount, currency=settings.razorpay_currency, order_id=order_id
        )


@router.get("/config")
def config() -> dict:
    """Public payment config for the checkout UI (key_id is publishable)."""
    return {
        "enabled": settings.razorpay_enabled,
        "dev_mode": _dev_mode(),
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
    if body.plan == "pro" and await supa.get_plan(user["id"]) == "business":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You're already on Business — renew Business instead.")

    payload = {
        "amount": amount,
        "currency": settings.razorpay_currency,
        "receipt": f"u{user['id'][:8]}-{body.plan}",
        "notes": {"user_id": user["id"], "plan": body.plan},
    }
    try:
        order = await _rzp("POST", "/orders", json=payload)
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
async def verify(body: VerifyIn, background: BackgroundTasks, user: dict = Depends(require_user)) -> dict:
    if not settings.razorpay_enabled:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Payments are not configured yet.")
    if not _verify_payment_signature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Payment verification failed.")
    try:
        paid = await _settle(body.razorpay_payment_id, body.razorpay_order_id)
    except httpx.HTTPError as exc:
        logger.warning("razorpay payment lookup failed", exc_info=True)
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            "We couldn't confirm the payment with Razorpay yet. If you were charged, your plan "
            "will be activated automatically in a few minutes.",
        ) from exc
    if paid is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This payment hasn't been completed.")
    if paid["user_id"] != user["id"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This payment belongs to a different account.")
    try:
        until, fresh = await _fulfil(paid)
    except Exception as exc:  # noqa: BLE001
        logger.error("plan grant failed for payment %s", paid["payment_id"], exc_info=True)
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Payment received, but activating your plan failed. It will be retried automatically.",
        ) from exc
    if fresh:
        background.add_task(
            email_mod.send_purchase_thankyou,
            user.get("email"),
            paid["plan"],
            until,
            amount=paid["amount"],
            currency=paid["currency"],
            order_id=paid["order_id"],
        )
    return {"plan": paid["plan"], "until": until}


@router.post("/dev-upgrade")
async def dev_upgrade(body: CreateOrderIn, background: BackgroundTasks, user: dict = Depends(require_user)) -> dict:
    """Local-testing shortcut: grant the plan WITHOUT payment. Only works when
    PAYMENTS_DEV_MODE=true and Razorpay keys are unset — refused everywhere else."""
    if not _dev_mode():
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Use checkout to upgrade.")
    if settings.plan_amount(body.plan) is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown plan.")
    until = await _grant_plan(user["id"], body.plan)
    background.add_task(email_mod.send_purchase_thankyou, user.get("email"), body.plan, until)
    return {"plan": body.plan, "until": until, "dev": True}


@router.post("/webhook")
async def webhook(request: Request, background: BackgroundTasks) -> dict:
    """Server-side confirmation (configure in the Razorpay dashboard)."""
    raw = await request.body()
    signature = request.headers.get("x-razorpay-signature", "")
    if not _verify_webhook_signature(raw, signature):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid signature.")

    try:
        event = json.loads(raw)
    except Exception:  # noqa: BLE001
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid payload.")

    if event.get("event") not in _WEBHOOK_EVENTS:
        return {"ok": True}
    payment_id = (((event.get("payload") or {}).get("payment") or {}).get("entity") or {}).get("id")
    if not payment_id:
        return {"ok": True}
    try:
        paid = await _settle(payment_id)
        if paid:
            until, fresh = await _fulfil(paid)
            if fresh:
                background.add_task(
                    _notify_purchase, paid["user_id"], paid["plan"], until, paid["amount"], paid["order_id"]
                )
    except Exception as exc:  # noqa: BLE001
        # A non-2xx makes Razorpay retry later (transient Razorpay/Supabase errors).
        logger.warning("webhook fulfilment failed for %s", payment_id, exc_info=True)
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Fulfilment failed; retry later.") from exc
    return {"ok": True}
