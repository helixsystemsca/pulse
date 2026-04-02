"""Best-effort outbound SMTP (invites, resets, contact form). Disabled when SMTP_HOST is unset."""

from __future__ import annotations

import asyncio
import html
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
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=12) as smtp:
            if settings.smtp_username:
                smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.sendmail(from_addr, recipients, raw)
        return

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=12) as smtp:
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

    hours = settings.system_invite_expire_hours
    display = settings.email_from_display.strip() or "Helix Systems"
    noreply = settings.email_from_noreply.strip()

    subject = f"Pulse — complete setup for {company_name}"
    text = (
        f"Hello,\n\n"
        f"You've been invited to create your Pulse company administrator account for "
        f"“{company_name}” on behalf of {display}.\n\n"
        "What to do next:\n"
        "1. Open the secure link below (or paste it into your browser).\n"
        "2. Choose a password and confirm your details to finish onboarding.\n"
        "3. Sign in at your organization's Pulse URL to manage your operation.\n\n"
        f"This link expires in {hours} hour(s) for security. If it expires, ask your Helix "
        "contact to send a new invitation.\n\n"
        f"Your personal link:\n{invite_url}\n\n"
        f"This message was sent automatically from {noreply}. Replies to this address may "
        "not be monitored. For help, contact your company’s administrator or Helix support.\n\n"
        "If you were not expecting this email, you can safely ignore it.\n"
    )

    safe_company = html.escape(company_name, quote=True)
    safe_url = html.escape(invite_url, quote=True)
    safe_display = html.escape(display, quote=True)
    safe_noreply = html.escape(noreply, quote=True)

    html_body = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5;color:#1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
        <tr><td style="padding:28px 28px 8px;font-size:18px;font-weight:700;color:#0f172a;">You’re invited to Pulse</td></tr>
        <tr><td style="padding:8px 28px 16px;font-size:15px;color:#334155;">
          Hello,
        </td></tr>
        <tr><td style="padding:0 28px 16px;font-size:15px;color:#334155;">
          You’ve been invited to set up the <strong>company administrator</strong> account for
          <strong>{safe_company}</strong> with {safe_display}.
        </td></tr>
        <tr><td style="padding:0 28px 12px;font-size:15px;color:#334155;">
          <strong style="display:block;margin-bottom:8px;color:#0f172a;">Steps</strong>
          <ol style="margin:0;padding-left:20px;color:#475569;">
            <li style="margin-bottom:6px;">Click the button below (or use the link at the bottom).</li>
            <li style="margin-bottom:6px;">Create your password and complete the short onboarding form.</li>
            <li>Sign in to Pulse to manage maintenance, scheduling, and your team.</li>
          </ol>
        </td></tr>
        <tr><td style="padding:16px 28px 24px;">
          <a href="{safe_url}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px;">Accept invitation</a>
        </td></tr>
        <tr><td style="padding:0 28px 20px;font-size:13px;color:#64748b;border-top:1px solid #e2e8f0;">
          <p style="margin:16px 0 8px;"><strong>Important</strong></p>
          <p style="margin:0 0 8px;">This invitation link expires in <strong>{hours}</strong> hour(s). After that, you’ll need a new invite from your administrator.</p>
          <p style="margin:0;font-size:12px;word-break:break-all;"><span style="color:#94a3b8;">Link:</span><br /><a href="{safe_url}" style="color:#2563eb;">{safe_url}</a></p>
        </td></tr>
        <tr><td style="padding:16px 28px 24px;background:#f8fafc;font-size:12px;color:#64748b;">
          Sent automatically from <span style="color:#475569;">{safe_noreply}</span>. If you didn’t expect this message, you can ignore it.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""
    msg = _build_message(
        subject=subject,
        from_addr=settings.email_from_noreply,
        from_display=settings.email_from_display,
        to_addrs=[to_email],
        text_body=text,
        html_body=html_body,
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
    reset_html = (
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
        html_body=reset_html,
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
