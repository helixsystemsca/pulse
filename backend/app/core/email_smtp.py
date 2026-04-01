"""Best-effort outbound SMTP (invites, resets, contact form). Disabled when SMTP_HOST is unset."""

from __future__ import annotations

import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from app.core.config import Settings

_log = logging.getLogger(__name__)


def _build_message(
    *,
    subject: str,
    from_addr: str,
    from_display: str,
    to_addrs: list[str],
    text_body: str,
    html_body: Optional[str] = None,
    reply_to: Optional[str] = None,
) -> MIMEMultipart:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{from_display} <{from_addr}>"
    msg["To"] = ", ".join(to_addrs)
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    if html_body:
        msg.attach(MIMEText(html_body, "html", "utf-8"))
    return msg


def _send_sync(settings: Settings, msg: MIMEMultipart) -> None:
    raw = msg.as_string()
    from_addr = settings.email_from_noreply.strip()
    to_raw = msg["To"]
    recipients = [a.strip() for a in to_raw.split(",") if a.strip()]

    if settings.smtp_use_ssl:
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=45) as smtp:
            if settings.smtp_username:
                smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.sendmail(from_addr, recipients, raw)
        return

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=45) as smtp:
        smtp.ehlo()
        if settings.smtp_use_tls:
            smtp.starttls()
            smtp.ehlo()
        if settings.smtp_username:
            smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.sendmail(from_addr, recipients, raw)


async def send_smtp_message(settings: Settings, msg: MIMEMultipart) -> None:
    await asyncio.to_thread(_send_sync, settings, msg)


async def send_company_admin_invite(
    settings: Settings,
    *,
    to_email: str,
    company_name: str,
    invite_url: str,
) -> bool:
    if not settings.smtp_configured:
        return False
    subject = f"You're invited to administer {company_name} on Pulse"
    text = (
        f"You've been invited to set up your company admin account for {company_name}.\n\n"
        f"Open this link to accept (expires in {settings.system_invite_expire_hours} hours):\n"
        f"{invite_url}\n\n"
        "If you didn't expect this, you can ignore this email.\n"
    )
    html = (
        f"<p>You've been invited to set up your company admin account for <strong>{company_name}</strong>.</p>"
        f'<p><a href="{invite_url}">Accept invitation</a></p>'
        "<p>If the button doesn't work, copy this URL into your browser:<br />"
        f'<code style="word-break:break-all">{invite_url}</code></p>'
        "<p style=\"color:#666;font-size:12px\">If you didn't expect this, you can ignore this email.</p>"
    )
    msg = _build_message(
        subject=subject,
        from_addr=settings.email_from_noreply,
        from_display=settings.email_from_display,
        to_addrs=[to_email],
        text_body=text,
        html_body=html,
    )
    try:
        await send_smtp_message(settings, msg)
        return True
    except Exception:
        _log.exception("SMTP company invite failed to=%s", to_email)
        return False


async def send_password_reset_email(
    settings: Settings,
    *,
    to_email: str,
    reset_url: str,
) -> bool:
    if not settings.smtp_configured:
        return False
    subject = "Reset your Pulse password"
    text = (
        "A password reset was requested for your account.\n\n"
        f"Open this link to choose a new password:\n{reset_url}\n\n"
        "If you didn't request this, you can ignore this email.\n"
    )
    html = (
        "<p>A password reset was requested for your account.</p>"
        f'<p><a href="{reset_url}">Reset password</a></p>'
        f'<p style="word-break:break-all"><code>{reset_url}</code></p>'
        "<p style=\"color:#666;font-size:12px\">If you didn't request this, ignore this email.</p>"
    )
    msg = _build_message(
        subject=subject,
        from_addr=settings.email_from_noreply,
        from_display=settings.email_from_display,
        to_addrs=[to_email],
        text_body=text,
        html_body=html,
    )
    try:
        await send_smtp_message(settings, msg)
        return True
    except Exception:
        _log.exception("SMTP password reset failed to=%s", to_email)
        return False


async def send_contact_lead(
    settings: Settings,
    *,
    from_name: str,
    from_email: str,
    company: str,
    message: str,
) -> bool:
    if not settings.smtp_configured:
        return False
    target = settings.email_to_info.strip()
    if not target:
        return False
    subject = f"[Helix contact] {from_name.strip() or from_email}"
    text = (
        f"Name: {from_name}\n"
        f"Email: {from_email}\n"
        f"Company: {company or '(none)'}\n\n"
        f"{message}\n"
    )
    msg = _build_message(
        subject=subject,
        from_addr=settings.email_from_noreply,
        from_display=settings.email_from_display,
        to_addrs=[target],
        text_body=text,
        reply_to=from_email,
    )
    try:
        await send_smtp_message(settings, msg)
        return True
    except Exception:
        _log.exception("SMTP contact form failed")
        return False
