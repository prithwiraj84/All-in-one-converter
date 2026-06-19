"""Background loop that emails renewal reminders before a paid plan lapses.

Runs only when a real email provider (Resend/SMTP) is configured. Each user is
reminded at most once per paid period (`renewal_reminded_at` is set after the
attempt and cleared whenever a plan is granted/renewed).
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from app.config import settings
from app.core import email, supa

logger = logging.getLogger("aio.reminders")


async def process_expiry_reminders() -> int:
    if not email.can_send():
        return 0
    profiles = await supa.expiring_profiles(settings.expiry_reminder_days)
    now = datetime.now(timezone.utc)
    sent = 0
    for p in profiles:
        addr = p.get("email")
        if not addr:
            continue
        try:
            until = datetime.fromisoformat((p.get("pro_until") or "").replace("Z", "+00:00"))
            days_left = max(0, (until - now).days)
        except Exception:  # noqa: BLE001
            days_left = settings.expiry_reminder_days
        ok = await email.send_expiry_reminder(addr, p.get("plan") or "pro", p.get("pro_until"), days_left)
        await supa.mark_reminded(p["id"])  # one attempt per period, success or not
        if ok:
            sent += 1
    if sent:
        logger.info("sent %d expiry reminder(s)", sent)
    return sent


async def reminder_loop() -> None:
    interval = max(1, settings.reminder_interval_hours) * 3600
    await asyncio.sleep(30)  # let startup finish first
    while True:
        try:
            await process_expiry_reminders()
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001
            logger.warning("reminder loop error", exc_info=True)
        await asyncio.sleep(interval)
