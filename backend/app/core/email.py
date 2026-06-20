"""Transactional email — team invites, purchase thank-you, expiry reminders.

Best-effort with graceful fallbacks: Resend (if `RESEND_API_KEY`) → SMTP (if
`SMTP_HOST`). Team invites additionally fall back to Supabase's invite email.
Senders never raise into the caller. Templates are responsive, table-based HTML
(email-safe) with a polished brand look + a popular-tools showcase.
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

# (emoji, name, tool slug) — linked in every email's "Popular tools" section.
POPULAR_TOOLS = [
    ("📄", "Merge PDF", "/merge-pdf"),
    ("🗜️", "Compress PDF", "/compress-pdf"),
    ("🖼️", "Image Converter", "/image-converter"),
    ("🎬", "Video Converter", "/video-converter"),
    ("✂️", "Background Remover", "/background-remover"),
    ("📝", "Word to PDF", "/word-to-pdf"),
]

# Progressive-enhancement CSS (kept out of f-strings so literal braces are safe).
# Animations/hover work where supported (Apple Mail/iOS); ignored elsewhere — the
# design looks great statically regardless.
_STYLE = """
<style>
  @media only screen and (max-width:600px){
    .container{width:100%!important}
    .px{padding-left:22px!important;padding-right:22px!important}
    .tool{display:block!important;width:100%!important;box-sizing:border-box}
  }
  .btn:hover{filter:brightness(1.08)}
  .tool a:hover{border-color:#c7d2fe!important}
  @keyframes aioShimmer{0%{background-position:0% 50%}100%{background-position:200% 50%}}
  .hdr{animation:aioShimmer 6s linear infinite alternate}
</style>
"""


def can_send() -> bool:
    return bool(settings.resend_api_key or settings.smtp_host)


def _app() -> str:
    return settings.app_url.rstrip("/")


def _fmt_date(iso: str | None) -> str:
    if not iso:
        return ""
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00")).strftime("%d %b %Y")
    except Exception:  # noqa: BLE001
        return ""


def _btn(label: str, href: str) -> str:
    return (
        f"<a class='btn' href='{href}' style='display:inline-block;"
        "background:linear-gradient(120deg,#2563EB,#7C3AED);background-color:#2563EB;color:#ffffff;"
        "text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:12px;"
        f"box-shadow:0 10px 22px -8px rgba(124,58,237,.65)'>{escape(label)}&nbsp;&nbsp;&rarr;</a>"
    )


def _features(items: list[tuple[str, str, str]]) -> str:
    rows = ""
    for emoji, title, desc in items:
        rows += (
            "<tr>"
            f"<td width='34' valign='top' style='font-size:20px;padding:9px 12px 9px 0;line-height:1.2'>{emoji}</td>"
            f"<td style='padding:9px 0'>"
            f"<div style='font-size:14px;font-weight:700;color:#0f172a'>{escape(title)}</div>"
            f"<div style='font-size:13px;color:#64748b;line-height:1.5'>{escape(desc)}</div>"
            "</td></tr>"
        )
    return (
        "<table role='presentation' width='100%' cellpadding='0' cellspacing='0' "
        "style='margin-top:6px;border-top:1px solid #eef1f6;border-bottom:1px solid #eef1f6'>"
        f"{rows}</table>"
    )


def _tools_section() -> str:
    app = _app()
    cells = ""
    for i, (emoji, name, slug) in enumerate(POPULAR_TOOLS):
        cells += (
            "<td class='tool' width='50%' valign='top' style='padding:5px'>"
            f"<a href='{app}{slug}' style='display:block;text-decoration:none;border:1px solid #e8ebf2;"
            "border-radius:12px;padding:12px 14px;background:#fbfcff'>"
            f"<span style='font-size:18px'>{emoji}</span>&nbsp;"
            f"<span style='font-size:14px;font-weight:600;color:#0f172a;vertical-align:middle'>{escape(name)}</span>"
            "</a></td>"
        )
        if i % 2 == 1:
            cells += "</tr><tr>"
    return (
        "<tr><td class='px' style='padding:6px 32px 2px'>"
        "<div style='font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;"
        "color:#94a3b8;margin:8px 0 10px'>Popular tools to try</div>"
        f"<table role='presentation' width='100%' cellpadding='0' cellspacing='0'><tr>{cells}</tr></table>"
        "</td></tr>"
    )


def _footer(reason: str) -> str:
    app = _app()
    link = "color:#2563EB;text-decoration:none;font-size:13px;font-weight:600"
    return (
        "<tr><td class='px' style='padding:20px 32px 30px'>"
        "<div style='border-top:1px solid #eef1f6;padding-top:16px'>"
        f"<a href='{app}/tools' style='{link}'>All tools</a>"
        f"&nbsp;&middot;&nbsp;<a href='{app}/dashboard' style='{link}'>Dashboard</a>"
        f"&nbsp;&middot;&nbsp;<a href='{app}/#pricing' style='{link}'>Pricing</a>"
        f"&nbsp;&middot;&nbsp;<a href='{app}/api-docs' style='{link}'>API</a>"
        f"<p style='margin:12px 0 0;color:#94a3b8;font-size:11px;line-height:1.6'>{escape(reason)}</p>"
        "<p style='margin:6px 0 0;color:#cbd5e1;font-size:11px'>&copy; All in one converter</p>"
        "</div></td></tr>"
    )


def _doc(
    *,
    preheader: str,
    hero_emoji: str,
    heading: str,
    intro_html: str,
    features_html: str,
    cta_label: str,
    cta_href: str,
    footer_reason: str,
    show_tools: bool = True,
) -> str:
    features_block = f"<div style='margin-top:20px'>{features_html}</div>" if features_html else ""
    tools_block = _tools_section() if show_tools else ""
    button_block = _btn(cta_label, cta_href)
    footer_block = _footer(footer_reason)
    font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
    return (
        "<!doctype html><html><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width,initial-scale=1'>"
        f"{_STYLE}</head>"
        f"<body style='margin:0;padding:0;background:#eef1f8;font-family:{font}'>"
        f"<span style='display:none;opacity:0;color:#eef1f8;font-size:1px;line-height:1px'>{escape(preheader)}</span>"
        "<table role='presentation' width='100%' cellpadding='0' cellspacing='0' "
        "style='background:#eef1f8;padding:30px 12px'><tr><td align='center'>"
        "<table role='presentation' class='container' width='560' cellpadding='0' cellspacing='0' "
        "style='width:560px;max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;"
        "box-shadow:0 12px 44px rgba(15,23,42,.12)'>"
        # ── header ──
        "<tr><td class='hdr' style='background:linear-gradient(120deg,#2563EB,#7C3AED,#06B6D4);"
        "background-size:200% 200%;padding:24px 32px'>"
        "<table role='presentation' width='100%'><tr>"
        "<td style='color:#ffffff;font-weight:800;font-size:19px;letter-spacing:-.3px'>All in one converter</td>"
        "<td align='right' style='color:#ffffffcc;font-size:12px;font-weight:600'>100+ free file tools</td>"
        "</tr></table></td></tr>"
        # ── animated gradient ribbon (GIF — animates in Gmail/Apple Mail too) ──
        "<tr><td style='font-size:0;line-height:0'>"
        f"<img src='{_app()}/email-banner.gif' width='560' height='13' alt='' "
        "style='display:block;width:100%;height:13px;border:0;margin:0' /></td></tr>"
        # ── hero + body ──
        "<tr><td class='px' style='padding:34px 36px 8px'>"
        f"<div style='font-size:44px;line-height:1'>{hero_emoji}</div>"
        f"<h1 style='margin:14px 0 10px;font-size:25px;color:#0f172a;letter-spacing:-.5px'>{heading}</h1>"
        f"<div style='color:#475569;font-size:15px;line-height:1.65'>{intro_html}</div>"
        f"{features_block}"
        f"<div style='margin:26px 0 4px'>{button_block}</div>"
        "</td></tr>"
        # ── popular tools ──
        f"{tools_block}"
        # ── footer ──
        f"{footer_block}"
        "</table></td></tr></table></body></html>"
    )


# ── Senders ─────────────────────────────────────────────────────────
async def _send_resend(to: str, subject: str, html: str, text: str) -> bool:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {settings.resend_api_key}", "Content-Type": "application/json"},
                # A plain-text part (multipart) materially improves deliverability.
                json={"from": settings.email_from, "to": [to], "subject": subject, "html": html, "text": text},
            )
        if resp.status_code < 300:
            return True
        logger.warning("resend send failed: %s %s", resp.status_code, resp.text[:200])
    except Exception:  # noqa: BLE001
        logger.warning("resend send error", exc_info=True)
    return False


def _smtp_send_blocking(to: str, subject: str, html: str, text: str) -> bool:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.email_from
    msg["To"] = to
    msg.set_content(text)  # plain-text part
    msg.add_alternative(html, subtype="html")
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as server:
        server.starttls()
        if settings.smtp_user:
            server.login(settings.smtp_user, settings.smtp_password or "")
        server.send_message(msg)
    return True


async def _send_smtp(to: str, subject: str, html: str, text: str) -> bool:
    try:
        return await run_in_threadpool(_smtp_send_blocking, to, subject, html, text)
    except Exception:  # noqa: BLE001
        logger.warning("smtp send error", exc_info=True)
        return False


async def _deliver(to: str, subject: str, html: str, text: str) -> bool:
    if not to:
        return False
    if settings.resend_api_key and await _send_resend(to, subject, html, text):
        return True
    if settings.smtp_host and await _send_smtp(to, subject, html, text):
        return True
    return False


def _plan_perks(label: str) -> list[tuple[str, str, str]]:
    storage = "20 GB" if label == "Business" else "2 GB"
    perks = [
        ("📦", "Larger uploads", "Convert files up to 1 GB each"),
        ("💾", "More storage", f"{storage} of room for your files"),
        ("⏳", "Longer retention", "Your files are kept for a full day"),
        ("🚫", "No ads", "A clean, distraction-free workspace"),
    ]
    if label == "Business":
        perks += [
            ("🔌", "REST API access", "Automate conversions from your own apps"),
            ("👥", "Team workspaces", "Invite your team under one plan"),
        ]
    return perks


# ── Public templates ────────────────────────────────────────────────
async def send_team_invite(to_email: str, team_name: str, inviter: str | None) -> bool:
    label = "Business"
    who = f"<strong>{escape(inviter)}</strong> invited you" if inviter else "You've been invited"
    intro = (
        f"{who} to join the <strong>{escape(team_name)}</strong> workspace on All in one converter. "
        "Joining gives you full <strong>Business</strong> access — just sign in with this email."
    )
    html = _doc(
        preheader=f"Join {team_name} and unlock Business access.",
        hero_emoji="✉️",
        heading=f"You're invited to {escape(team_name)}",
        intro_html=intro,
        features_html=_features(_plan_perks(label)),
        cta_label="Accept invitation",
        cta_href=f"{_app()}/signup",
        footer_reason="You received this because someone invited you to their team on All in one converter.",
    )
    subject = f"You're invited to {team_name} on All in one converter"
    text = (
        f"You're invited to {team_name} on All in one converter.\n"
        f"Sign in (or sign up) with this email to join and get Business access:\n{_app()}/signup"
    )
    if await _deliver(to_email, subject, html, text):
        return True
    from app.core import supa

    if supa.is_configured():
        return await supa.send_invite_email(to_email)
    return False


async def send_purchase_thankyou(to_email: str, plan: str, until_iso: str | None) -> bool:
    label = (plan or "Pro").capitalize()
    until = _fmt_date(until_iso)
    intro = (
        f"Thank you for upgrading to <strong>{label}</strong>! Your plan is active"
        + (f" until <strong>{until}</strong>" if until else "")
        + ". Here's everything you've unlocked:"
    )
    html = _doc(
        preheader=f"Your {label} plan is active. Here's what you unlocked.",
        hero_emoji="🎉",
        heading=f"Welcome to {label}!",
        intro_html=intro,
        features_html=_features(_plan_perks(label)),
        cta_label="Open your dashboard",
        cta_href=f"{_app()}/dashboard",
        footer_reason="You received this because you upgraded your plan on All in one converter.",
    )
    text = (
        f"Thanks for upgrading to {label}! Your plan is active"
        + (f" until {until}" if until else "")
        + f".\nOpen your dashboard: {_app()}/dashboard"
    )
    return await _deliver(to_email, f"Thanks for upgrading to {label} 🎉", html, text)


async def send_expiry_reminder(to_email: str, plan: str, until_iso: str | None, days_left: int) -> bool:
    label = (plan or "Pro").capitalize()
    until = _fmt_date(until_iso)
    when = "today" if days_left <= 0 else "tomorrow" if days_left == 1 else f"in {days_left} days"
    intro = (
        f"Your <strong>{label}</strong> plan expires <strong>{when}</strong>"
        + (f" (on {until})" if until else "")
        + ". Renew now to keep these benefits — if it lapses you simply return to Free; your files and history stay."
    )
    html = _doc(
        preheader=f"Your {label} plan expires {when}. Renew to keep your benefits.",
        hero_emoji="⏰",
        heading=f"Your {label} plan expires {when}",
        intro_html=intro,
        features_html=_features(_plan_perks(label)),
        cta_label=f"Renew {label}",
        cta_href=f"{_app()}/dashboard?tab=settings",
        footer_reason="You received this because your paid plan on All in one converter is about to expire.",
    )
    text = (
        f"Your {label} plan expires {when}"
        + (f" (on {until})" if until else "")
        + f".\nRenew to keep your benefits: {_app()}/dashboard?tab=settings"
    )
    return await _deliver(to_email, f"Your {label} plan expires {when}", html, text)
