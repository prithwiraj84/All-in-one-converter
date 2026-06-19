"""Transactional email — team invites, purchase thank-you, expiry reminders.

Best-effort with graceful fallbacks: Resend (if `RESEND_API_KEY`) → SMTP (if
`SMTP_HOST`). Team invites additionally fall back to Supabase's built-in invite
email. Nothing here ever raises into the caller — email is a notification, not a
dependency of the action that triggered it.
"""
from __future__ import annotations

import logging
import smtplib
from datetime import datetime
from email.message import EmailMessage
from html import escape

import httpx
from starlette.concurrency import run_in_threadpool

from app.config import settings

logger = logging.getLogger("aio.email")


def can_send() -> bool:
    """True if a real outbound provider (Resend/SMTP) is configured."""
    return bool(settings.resend_api_key or settings.smtp_host)


def _fmt_date(iso: str | None) -> str:
    if not iso:
        return ""
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00")).strftime("%d %b %Y")
    except Exception:  # noqa: BLE001
        return ""


def _shell(heading: str, body_html: str, cta_label: str | None = None, cta_link: str | None = None) -> str:
    cta = ""
    if cta_label and cta_link:
        cta = (
            f'<a href="{cta_link}" style="display:inline-block;background:linear-gradient(120deg,#2563EB,#7C3AED);'
            f'color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:10px">'
            f"{escape(cta_label)}</a>"
        )
    return f"""\
<!doctype html><html><body style="margin:0;background:#f6f7fb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
   <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,.08)">
     <tr><td style="background:linear-gradient(120deg,#2563EB,#7C3AED);padding:22px 28px;color:#fff;font-weight:700;font-size:18px">All in one converter</td></tr>
     <tr><td style="padding:28px">
       <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a">{heading}</h1>
       {body_html}
       {('<div style="margin-top:18px">' + cta + '</div>') if cta else ''}
     </td></tr>
    </table>
    <p style="color:#94a3b8;font-size:11px;margin:16px 0 0">© All in one converter</p>
   </td></tr>
  </table>
</body></html>"""


async def _send_resend(to: str, subject: str, html: str) -> bool:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {settings.resend_api_key}", "Content-Type": "application/json"},
                json={"from": settings.email_from, "to": [to], "subject": subject, "html": html},
            )
        if resp.status_code < 300:
            return True
        logger.warning("resend send failed: %s %s", resp.status_code, resp.text[:200])
    except Exception:  # noqa: BLE001
        logger.warning("resend send error", exc_info=True)
    return False


def _smtp_send_blocking(to: str, subject: str, html: str) -> bool:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.email_from
    msg["To"] = to
    msg.set_content("Open this email in an HTML-capable client.")
    msg.add_alternative(html, subtype="html")
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as server:
        server.starttls()
        if settings.smtp_user:
            server.login(settings.smtp_user, settings.smtp_password or "")
        server.send_message(msg)
    return True


async def _send_smtp(to: str, subject: str, html: str) -> bool:
    try:
        return await run_in_threadpool(_smtp_send_blocking, to, subject, html)
    except Exception:  # noqa: BLE001
        logger.warning("smtp send error", exc_info=True)
        return False


async def _deliver(to: str, subject: str, html: str) -> bool:
    """Send via the first configured real provider (Resend → SMTP)."""
    if not to:
        return False
    if settings.resend_api_key and await _send_resend(to, subject, html):
        return True
    if settings.smtp_host and await _send_smtp(to, subject, html):
        return True
    return False


# ── Templates / senders ─────────────────────────────────────────────
async def send_team_invite(to_email: str, team_name: str, inviter: str | None) -> bool:
    """Invite email. Falls back to Supabase's invite email if no Resend/SMTP."""
    subject = f"You're invited to {team_name} on All in one converter"
    link = f"{settings.app_url.rstrip('/')}/signup"
    who = f" by {escape(inviter)}" if inviter else ""
    body = (
        f'<p style="margin:0;color:#475569;font-size:14px;line-height:1.6">You\'ve been invited{who} to join the '
        f"<strong>{escape(team_name)}</strong> workspace. Joining gives you Business access — bigger files, more "
        "storage, no ads, and the REST API.</p>"
        '<p style="margin:14px 0 0;color:#94a3b8;font-size:12px;line-height:1.6">Sign in (or sign up) with '
        "<strong>this email address</strong> and your Business access is applied automatically.</p>"
    )
    html = _shell(f"You're invited to {escape(team_name)}", body, "Accept invitation", link)
    if await _deliver(to_email, subject, html):
        return True
    # Fallback: Supabase's own invite email (no extra setup; new addresses only).
    from app.core import supa

    if supa.is_configured():
        return await supa.send_invite_email(to_email)
    return False


async def send_purchase_thankyou(to_email: str, plan: str, until_iso: str | None) -> bool:
    """Thank-you / receipt email after a successful upgrade or renewal."""
    label = (plan or "Pro").capitalize()
    until = _fmt_date(until_iso)
    subject = f"Thanks for upgrading to {label} 🎉"
    body = (
        f'<p style="margin:0;color:#475569;font-size:14px;line-height:1.6">Thank you for upgrading to '
        f"<strong>{label}</strong>! Your account is active"
        + (f" until <strong>{until}</strong>" if until else "")
        + ".</p>"
        '<p style="margin:14px 0 0;color:#475569;font-size:14px;line-height:1.6">You now have larger file limits, '
        "more storage, longer file retention, and no ads."
        + (" Manage your team and API keys from the dashboard." if label == "Business" else "")
        + "</p>"
    )
    html = _shell(f"Welcome to {label} 🎉", body, "Open your dashboard", f"{settings.app_url.rstrip('/')}/dashboard")
    return await _deliver(to_email, subject, html)


async def send_expiry_reminder(to_email: str, plan: str, until_iso: str | None, days_left: int) -> bool:
    """Reminder that a paid plan is about to lapse."""
    label = (plan or "Pro").capitalize()
    until = _fmt_date(until_iso)
    when = "today" if days_left <= 0 else "tomorrow" if days_left == 1 else f"in {days_left} days"
    subject = f"Your {label} plan expires {when}"
    body = (
        f'<p style="margin:0;color:#475569;font-size:14px;line-height:1.6">Your <strong>{label}</strong> plan expires '
        f"<strong>{when}</strong>"
        + (f" (on {until})" if until else "")
        + ". Renew now to keep your larger limits, extra storage and ad-free experience.</p>"
        '<p style="margin:14px 0 0;color:#94a3b8;font-size:12px;line-height:1.6">If you let it lapse, your account '
        "simply returns to the Free plan — your files and history stay.</p>"
    )
    html = _shell(
        f"Your {label} plan expires {when}", body, f"Renew {label}", f"{settings.app_url.rstrip('/')}/dashboard?tab=settings"
    )
    return await _deliver(to_email, subject, html)
