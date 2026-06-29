"""Transactional email — team invites, purchase thank-you, expiry reminders.

Polished, responsive, table-based HTML (email-safe) with a branded header + plan
badge, a feature grid of the *real* plan perks, an order-details card (purchase),
a CTA, a help section, and a dark footer. Best-effort delivery: Resend (if
`RESEND_API_KEY`) → SMTP (if `SMTP_HOST`); invites also fall back to Supabase's
invite email. Senders never raise into the caller.
"""
from __future__ import annotations

import logging
import smtplib
from datetime import datetime, timezone
from email.message import EmailMessage
from html import escape

import httpx
from starlette.concurrency import run_in_threadpool

from app.config import settings

logger = logging.getLogger("aio.email")

_FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
SUPPORT_EMAIL = "info@toshiconsulting.com"

# Progressive-enhancement CSS (kept out of f-strings so literal braces are safe).
_STYLE = """
<style>
  @media only screen and (max-width:620px){
    .container{width:100%!important}
    .px{padding-left:22px!important;padding-right:22px!important}
    .stack{display:block!important;width:100%!important;box-sizing:border-box;padding-left:0!important}
  }
  .btn:hover{filter:brightness(1.08)}
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


def _fmt_amount(paise: int | None, currency: str) -> str:
    if not paise:
        return "Complimentary"
    major = paise / 100
    if (currency or "INR").upper() == "INR":
        return f"₹{major:,.0f}"
    return f"{major:,.2f} {currency}"


# ── Building blocks ─────────────────────────────────────────────────
def _plan_pill(text: str) -> str:
    if text.upper() in ("PRO", "BUSINESS"):
        return (
            "<span style='display:inline-block;background:linear-gradient(120deg,#f59e0b,#f97316);color:#ffffff;"
            "font-weight:800;font-size:12px;letter-spacing:.06em;padding:6px 14px;border-radius:999px;"
            f"box-shadow:0 4px 12px -3px rgba(245,158,11,.55)'>\U0001F451 {escape(text)}</span>"
        )
    # Non-plan badge (e.g. WELCOME) — brand gradient, no crown.
    return (
        "<span style='display:inline-block;background:linear-gradient(120deg,#2563EB,#7C3AED);color:#ffffff;"
        "font-weight:800;font-size:12px;letter-spacing:.06em;padding:6px 14px;border-radius:999px;"
        f"box-shadow:0 4px 12px -3px rgba(124,58,237,.5)'>✨ {escape(text)}</span>"
    )


def _btn(label: str, href: str) -> str:
    return (
        f"<a class='btn' href='{href}' style='display:inline-block;"
        "background:linear-gradient(120deg,#2563EB,#7C3AED);background-color:#2563EB;color:#ffffff;"
        "text-decoration:none;font-weight:700;font-size:15px;padding:14px 30px;border-radius:12px;"
        f"box-shadow:0 10px 22px -8px rgba(124,58,237,.65)'>{escape(label)}&nbsp;&nbsp;&rarr;</a>"
    )


def _hero(emoji: str, heading_html: str, intro_html: str) -> str:
    return (
        f"<div style='font-size:40px;line-height:1'>{emoji}</div>"
        f"<h1 style='margin:12px 0 0;font-size:26px;line-height:1.22;color:#0f172a;letter-spacing:-.5px'>{heading_html}</h1>"
        "<div style='width:54px;height:4px;border-radius:3px;background:linear-gradient(90deg,#2563EB,#7C3AED);margin:16px 0'></div>"
        f"<div style='color:#475569;font-size:15px;line-height:1.65'>{intro_html}</div>"
    )


def _feature_grid(items: list[tuple[str, str, str]]) -> str:
    def cell(emoji: str, label: str, bg: str) -> str:
        return (
            "<td align='center' valign='top' width='33%' style='padding:10px 6px'>"
            f"<div style='width:50px;height:50px;line-height:50px;border-radius:50%;background:{bg};font-size:23px;margin:0 auto'>{emoji}</div>"
            f"<div style='margin-top:8px;font-size:12px;font-weight:600;color:#334155;line-height:1.35'>{escape(label)}</div>"
            "</td>"
        )

    rows = ""
    for i in range(0, len(items), 3):
        chunk = items[i : i + 3]
        rows += "<tr>" + "".join(cell(e, l, c) for e, l, c in chunk) + "</tr>"
    return f"<table role='presentation' width='100%' cellpadding='0' cellspacing='0'>{rows}</table>"


def _features_block(title: str, items: list[tuple[str, str, str]]) -> str:
    return (
        "<div style='margin-top:26px;background:#f8fafc;border:1px solid #eef1f6;border-radius:14px;padding:20px 16px'>"
        f"<p style='margin:0 0 12px;text-align:center;font-size:16px;font-weight:700;color:#0f172a'>{escape(title)}</p>"
        f"{_feature_grid(items)}"
        "</div>"
    )


def _order_block(plan_label: str, rows: list[tuple[str, str]]) -> str:
    row_html = ""
    for k, v in rows:
        row_html += (
            "<tr>"
            f"<td style='padding:8px 0;font-size:13px;color:#64748b'>{escape(k)}</td>"
            f"<td align='right' style='padding:8px 0;font-size:13px;font-weight:600;color:#0f172a'>{v}</td>"
            "</tr>"
        )
    badge = (
        "<div style='display:inline-block;background:linear-gradient(135deg,#2563EB,#7C3AED);border-radius:14px;"
        "padding:16px 22px;text-align:center;color:#ffffff'>"
        "<div style='font-size:26px;line-height:1'>\U0001F451</div>"
        f"<div style='margin-top:4px;font-weight:800;font-size:17px;letter-spacing:.05em'>{escape(plan_label.upper())}</div>"
        "<div style='display:inline-block;margin-top:8px;background:#22c55e;color:#ffffff;font-size:11px;font-weight:700;"
        "padding:3px 12px;border-radius:999px'>ACTIVE &#10003;</div></div>"
    )
    return (
        "<div style='margin-top:22px;border:1px solid #eef1f6;border-radius:14px;padding:20px'>"
        "<p style='margin:0 0 8px;font-size:15px;font-weight:700;color:#0f172a'>\U0001F4CB Your order details</p>"
        "<table role='presentation' width='100%'><tr>"
        f"<td valign='middle' class='stack' width='60%'><table role='presentation' width='100%'>{row_html}</table></td>"
        f"<td valign='middle' align='center' class='stack' width='40%' style='padding-left:12px'>{badge}</td>"
        "</tr></table></div>"
    )


def _cta_block(label: str, href: str, subtext: str) -> str:
    return (
        "<div style='margin-top:26px;text-align:center'>"
        f"{_btn(label, href)}"
        f"<p style='margin:14px 0 0;font-size:13px;color:#64748b'>{escape(subtext)}</p>"
        "</div>"
    )


def _help_block() -> str:
    app = _app()
    link = "font-size:13px;font-weight:600;color:#2563EB;text-decoration:none"
    return (
        "<div style='margin-top:22px;background:#f8fafc;border:1px solid #eef1f6;border-radius:14px;padding:18px'>"
        "<table role='presentation' width='100%'><tr>"
        "<td valign='top' class='stack' width='50%' style='padding:4px 10px'>"
        "<p style='margin:0;font-size:14px;font-weight:700;color:#0f172a'>\U0001F3A7 Need help?</p>"
        "<p style='margin:3px 0 6px;font-size:12px;color:#64748b'>We&rsquo;re here for you.</p>"
        f"<a href='mailto:{SUPPORT_EMAIL}' style='{link}'>Contact support &rarr;</a></td>"
        "<td valign='top' class='stack' width='50%' style='padding:4px 10px'>"
        "<p style='margin:0;font-size:14px;font-weight:700;color:#0f172a'>✉️ Have questions?</p>"
        "<p style='margin:3px 0 6px;font-size:12px;color:#64748b'>Browse the tools &amp; FAQ.</p>"
        f"<a href='{app}/#how-it-works' style='{link}'>Visit help center &rarr;</a></td>"
        "</tr></table></div>"
    )


def _footer(reason: str) -> str:
    app = _app()
    link = "color:#93c5fd;text-decoration:none;font-size:12px"
    return (
        "<tr><td style='background:#0b1220;padding:24px 32px'>"
        "<table role='presentation' width='100%'><tr>"
        "<td style='color:#ffffff;font-weight:800;font-size:15px'>\U0001F504 All in one converter</td>"
        f"<td align='right'><a href='{app}/tools' style='{link}'>Tools</a>&nbsp;&middot;&nbsp;"
        f"<a href='{app}/dashboard' style='{link}'>Dashboard</a>&nbsp;&middot;&nbsp;"
        f"<a href='{app}/#pricing' style='{link}'>Pricing</a>&nbsp;&middot;&nbsp;"
        f"<a href='{app}/api-docs' style='{link}'>API</a></td>"
        "</tr></table>"
        "<p style='margin:10px 0 0;color:#94a3b8;font-size:12px'>All your file conversion needs, in one powerful solution.</p>"
        f"<p style='margin:14px 0 0;color:#64748b;font-size:11px;line-height:1.6'>&copy; All in one converter. {escape(reason)}</p>"
        "</td></tr>"
    )


def _page(preheader: str, plan_badge: str, inner: str, footer_reason: str) -> str:
    app = _app()
    return (
        "<!doctype html><html><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width,initial-scale=1'>"
        f"{_STYLE}</head>"
        f"<body style='margin:0;padding:0;background:#eef1f8;font-family:{_FONT}'>"
        f"<span style='display:none;opacity:0;color:#eef1f8;font-size:1px;line-height:1px'>{escape(preheader)}</span>"
        "<table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='background:#eef1f8;padding:28px 12px'>"
        "<tr><td align='center'>"
        "<table role='presentation' class='container' width='600' cellpadding='0' cellspacing='0' "
        "style='width:600px;max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 12px 44px rgba(15,23,42,.12)'>"
        # ── header (white) ──
        "<tr><td style='padding:20px 32px;border-bottom:1px solid #eef1f6'>"
        "<table role='presentation' width='100%'><tr>"
        "<td style='font-weight:800;font-size:18px;color:#0f172a'>\U0001F504 All in one converter</td>"
        f"<td align='right'>{_plan_pill(plan_badge)}</td>"
        "</tr></table></td></tr>"
        # ── animated gradient ribbon (GIF — animates in Gmail/Apple Mail too) ──
        "<tr><td style='font-size:0;line-height:0'>"
        f"<img src='{app}/email-banner.gif' width='600' height='10' alt='' style='display:block;width:100%;height:10px;border:0'/></td></tr>"
        # ── body ──
        f"<tr><td class='px' style='padding:30px 36px'>{inner}</td></tr>"
        # ── footer (dark) ──
        f"{_footer(footer_reason)}"
        "</table></td></tr></table></body></html>"
    )


def _perk_items(label: str) -> list[tuple[str, str, str]]:
    storage = "20 GB storage" if label == "Business" else "2 GB storage"
    items = [
        ("♾️", "Unlimited conversions", "#e0e7ff"),
        ("\U0001F4E6", "Files up to 1 GB", "#dcfce7"),
        ("\U0001F4BE", storage, "#ede9fe"),
        ("\U0001F9F0", "100+ tools", "#ffedd5"),
    ]
    if label == "Business":
        items += [("\U0001F50C", "REST API access", "#cffafe"), ("\U0001F465", "Team workspaces", "#fce7f3")]
    else:
        items += [("⏳", "Files kept 1 day", "#cffafe"), ("\U0001F6AB", "No ads", "#fce7f3")]
    return items


# ── Delivery ────────────────────────────────────────────────────────
_UNSUB = f"<mailto:{SUPPORT_EMAIL}?subject=unsubscribe>"


async def _send_resend(to: str, subject: str, html: str, text: str) -> bool:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {settings.resend_api_key}", "Content-Type": "application/json"},
                json={
                    "from": settings.email_from,
                    "to": [to],
                    "subject": subject,
                    "html": html,
                    "text": text,
                    # Deliverability: a real reply-to + List-Unsubscribe signal legitimacy.
                    "reply_to": SUPPORT_EMAIL,
                    "headers": {"List-Unsubscribe": _UNSUB},
                },
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
    msg["Reply-To"] = SUPPORT_EMAIL
    msg["List-Unsubscribe"] = _UNSUB
    msg.set_content(text)
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


# ── Public templates ────────────────────────────────────────────────
async def send_purchase_thankyou(
    to_email: str,
    plan: str,
    until_iso: str | None,
    *,
    amount: int | None = None,
    currency: str | None = None,
    order_id: str | None = None,
) -> bool:
    label = (plan or "Pro").capitalize()
    until = _fmt_date(until_iso)
    days = settings.plan_period_days(plan)
    cycle = "Monthly" if days == 30 else "Annual" if days == 365 else f"{days} days"
    amount_str = _fmt_amount(amount, currency or settings.razorpay_currency)

    hero = _hero(
        "\U0001F389",
        f"Thank you for choosing<br>All in one converter "
        f"<span style='color:#7C3AED'>{label}!</span>",
        f"Your <strong>{label}</strong> subscription is now active. You now have access to all premium "
        "features and tools.",
    )
    feats = _features_block(f"Unlock the power of {label}", _perk_items(label))
    rows = [
        ("Plan", f"All in one converter {label}"),
        ("Order ID", escape(order_id) if order_id else "—"),
        ("Date", datetime.now(timezone.utc).strftime("%d %b %Y")),
        ("Billing cycle", cycle),
        ("Amount paid", f"<span style='color:#16a34a;font-weight:700'>{amount_str}</span>"),
    ]
    order = _order_block(label, rows)
    cta = _cta_block(
        "Go to dashboard", f"{_app()}/dashboard",
        "Start converting, editing and managing your files like a pro!",
    )
    inner = hero + feats + order + cta + _help_block()
    html = _page(
        preheader=f"Your {label} subscription is now active.",
        plan_badge=label.upper(),
        inner=inner,
        footer_reason="You are receiving this email because you made a purchase.",
    )
    text = (
        f"Thank you for choosing All in one converter {label}!\n"
        f"Your {label} subscription is now active"
        + (f" until {until}" if until else "")
        + f".\nAmount paid: {amount_str} ({cycle})"
        + (f" · Order {order_id}" if order_id else "")
        + f"\nOpen your dashboard: {_app()}/dashboard"
    )
    return await _deliver(to_email, f"Welcome to {label} — your subscription is now active", html, text)


_WELCOME_ITEMS = [
    ("\U0001F9F0", "100+ free tools", "#e0e7ff"),
    ("\U0001F4C4", "PDF tools", "#dcfce7"),
    ("\U0001F5BC️", "Image tools", "#ede9fe"),
    ("\U0001F3AC", "Audio & video", "#ffedd5"),
    ("\U0001F512", "Files auto-deleted", "#cffafe"),
    ("⚡", "Fast & free", "#fce7f3"),
]


async def send_welcome(to_email: str, name: str | None = None) -> bool:
    first = (name or "").strip().split(" ")[0] if name else ""
    heading = f"Welcome aboard{', ' + escape(first) if first else ''}! \U0001F44B"
    hero = _hero(
        "\U0001F44B",
        heading,
        "Your <strong>All in one converter</strong> account is ready. Convert, compress, edit and optimize "
        "your files with 100+ free tools — no watermarks, no hassle.",
    )
    feats = _features_block("What you can do", _WELCOME_ITEMS)
    cta = _cta_block(
        "Explore all tools", f"{_app()}/tools",
        "Most tools work instantly, right in your browser.",
    )
    inner = hero + feats + cta + _help_block()
    html = _page(
        preheader="Your account is ready — start converting with 100+ free tools.",
        plan_badge="WELCOME",
        inner=inner,
        footer_reason="You are receiving this email because you signed up.",
    )
    text = (
        "Welcome to All in one converter! Your account is ready.\n"
        f"Explore 100+ free tools: {_app()}/tools"
    )
    return await _deliver(to_email, "Welcome to All in one converter", html, text)


async def send_team_invite(to_email: str, team_name: str, inviter: str | None) -> bool:
    who = f"<strong>{escape(inviter)}</strong> invited you" if inviter else "You&rsquo;ve been invited"
    hero = _hero(
        "✉️",
        f"You&rsquo;re invited to<br>{escape(team_name)}",
        f"{who} to join the <strong>{escape(team_name)}</strong> workspace on All in one converter — "
        "and unlock full <strong>Business</strong> access.",
    )
    feats = _features_block("What you&rsquo;ll unlock", _perk_items("Business"))
    cta = _cta_block(
        "Accept invitation", f"{_app()}/signup",
        "Sign in (or sign up) with this email and your Business access is applied automatically.",
    )
    inner = hero + feats + cta + _help_block()
    html = _page(
        preheader=f"Join {team_name} and unlock Business access.",
        plan_badge="BUSINESS",
        inner=inner,
        footer_reason="You are receiving this email because you were invited to a team.",
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


async def send_expiry_reminder(to_email: str, plan: str, until_iso: str | None, days_left: int) -> bool:
    label = (plan or "Pro").capitalize()
    until = _fmt_date(until_iso)
    when = "today" if days_left <= 0 else "tomorrow" if days_left == 1 else f"in {days_left} days"
    hero = _hero(
        "⏰",
        f"Your {label} plan expires {when}",
        f"Renew now to keep your premium features"
        + (f" — your plan ends on <strong>{until}</strong>" if until else "")
        + ". If it lapses you simply return to Free; your files and history stay.",
    )
    feats = _features_block(f"Keep your {label} benefits", _perk_items(label))
    cta = _cta_block(
        f"Renew {label}", f"{_app()}/dashboard?tab=settings",
        "Renew in a couple of clicks from your dashboard.",
    )
    inner = hero + feats + cta + _help_block()
    html = _page(
        preheader=f"Your {label} plan expires {when}. Renew to keep your benefits.",
        plan_badge=label.upper(),
        inner=inner,
        footer_reason="You are receiving this email because your paid plan is about to expire.",
    )
    text = (
        f"Your {label} plan expires {when}"
        + (f" (on {until})" if until else "")
        + f".\nRenew to keep your benefits: {_app()}/dashboard?tab=settings"
    )
    return await _deliver(to_email, f"Your {label} plan expires {when}", html, text)
