"""Best-effort outbound SMTP (invites, resets, contact form). Disabled when SMTP_HOST is unset."""

from __future__ import annotations

import asyncio
import html
import logging
import smtplib
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from app.core.config import Settings

_log = logging.getLogger(__name__)


def outbound_smtp_configuration_error(settings: Settings) -> str | None:
    """Return a user-facing reason when outbound SMTP is not ready (server env / Settings)."""
    if not settings.smtp_host.strip():
        return "SMTP host not configured"
    if not settings.email_from_noreply.strip():
        return "SMTP sender email not configured"
    return None


def smtp_settings_log_extra(settings: Settings) -> dict[str, object]:
    """Safe SMTP fields for structured logs (never includes password)."""
    return {
        "smtp_host": settings.smtp_host.strip(),
        "smtp_port": settings.smtp_port,
        "smtp_username": settings.smtp_username.strip() or None,
        "smtp_from_email": settings.email_from_noreply.strip(),
        "smtp_from_name": settings.email_from_display.strip() or None,
    }


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
        "2. Choose a password and confirm your details to finish account setup.\n"
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
            <li style="margin-bottom:6px;">Create your password and complete the short setup form.</li>
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


async def send_employee_invite(
    settings: Settings,
    *,
    to_email: str,
    company_name: str,
    invite_url: str,
) -> bool:
    """Invite an existing user row to set their password (tenant employee invite)."""
    if not settings.smtp_configured:
        return False

    hours = settings.system_invite_expire_hours
    display = settings.email_from_display.strip() or "Helix Systems"
    noreply = settings.email_from_noreply.strip()

    subject = f"Pulse — you’re invited to join {company_name}"
    text = (
        f"Hello,\n\n"
        f"You’ve been invited to join “{company_name}” on Pulse ({display}).\n\n"
        "Open the link below to choose your password and activate your account:\n\n"
        f"{invite_url}\n\n"
        f"This link expires in {hours} hour(s). Ask your administrator for a new invite if needed.\n\n"
        f"Sent from {noreply}.\n"
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
        <tr><td style="padding:28px 28px 8px;font-size:18px;font-weight:700;color:#0f172a;">Join your team on Pulse</td></tr>
        <tr><td style="padding:8px 28px 16px;font-size:15px;color:#334155;">
          You’ve been invited to <strong>{safe_company}</strong> ({safe_display}).
        </td></tr>
        <tr><td style="padding:16px 28px 24px;">
          <a href="{safe_url}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px;">Accept invitation</a>
        </td></tr>
        <tr><td style="padding:0 28px 20px;font-size:13px;color:#64748b;">
          <p style="margin:0 0 8px;">This link expires in <strong>{hours}</strong> hour(s).</p>
          <p style="margin:0;font-size:12px;word-break:break-all;"><a href="{safe_url}" style="color:#2563eb;">{safe_url}</a></p>
        </td></tr>
        <tr><td style="padding:16px 28px 24px;background:#f8fafc;font-size:12px;color:#64748b;">
          Sent from {safe_noreply}.
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
        _log.exception("SMTP employee invite failed to=%s", to_email)
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


async def send_planning_idea_approval_request(
    settings: Settings,
    *,
    to_email: str,
    reviewer_name: str,
    requester_name: str,
    idea_title: str,
    idea_description: Optional[str],
    idea_location: Optional[str],
    estimated_cost: Optional["Decimal"],
    priority: str,
    request_comments: Optional[str],
    review_url: str,
    approve_url: str,
    reject_url: str,
) -> bool:
    """Notify a manager that a planning idea needs approval (button links, not reply-by-email)."""
    if not settings.smtp_configured:
        return False

    from decimal import Decimal

    display = settings.email_from_display.strip() or "Pulse"
    noreply = settings.email_from_noreply.strip()
    cost_line = "—"
    if estimated_cost is not None:
        try:
            cost_line = f"${Decimal(str(estimated_cost)):,.0f}"
        except Exception:
            cost_line = str(estimated_cost)

    subject = f"Planning approval requested — {idea_title.strip()[:80]}"
    desc = (idea_description or "").strip() or "(no description)"
    loc = (idea_location or "").strip() or "—"
    comments_block = ""
    if request_comments and request_comments.strip():
        comments_block = f"\nRequester notes:\n{request_comments.strip()}\n"

    text = (
        f"Hello {reviewer_name},\n\n"
        f"{requester_name} submitted a project idea for your approval.\n\n"
        f"Title: {idea_title}\n"
        f"Priority: {priority}\n"
        f"Estimated cost: {cost_line}\n"
        f"Location: {loc}\n\n"
        f"Description:\n{desc}\n"
        f"{comments_block}\n"
        f"Review details: {review_url}\n"
        f"Approve: {approve_url}\n"
        f"Reject: {reject_url}\n\n"
        "Use the links above — do not reply to this email.\n"
    )

    safe_title = html.escape(idea_title, quote=True)
    safe_requester = html.escape(requester_name, quote=True)
    safe_reviewer = html.escape(reviewer_name, quote=True)
    safe_desc = html.escape(desc[:2000], quote=True)
    safe_loc = html.escape(loc, quote=True)
    safe_priority = html.escape(priority, quote=True)
    safe_cost = html.escape(cost_line, quote=True)
    safe_review = html.escape(review_url, quote=True)
    safe_approve = html.escape(approve_url, quote=True)
    safe_reject = html.escape(reject_url, quote=True)
    comments_html = ""
    if request_comments and request_comments.strip():
        comments_html = (
            f'<p style="margin:12px 0 0;font-size:14px;color:#475569;">'
            f"<strong>Requester notes:</strong><br/>{html.escape(request_comments.strip(), quote=True)}</p>"
        )

    html_body = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:12px;border:1px solid #e2e8f0;">
        <tr><td style="padding:24px 24px 8px;font-size:18px;font-weight:700;">Planning idea — approval requested</td></tr>
        <tr><td style="padding:8px 24px 16px;font-size:15px;color:#334155;">
          Hello {safe_reviewer}, <strong>{safe_requester}</strong> submitted an idea for your review.
        </td></tr>
        <tr><td style="padding:0 24px 16px;">
          <table width="100%" style="font-size:14px;color:#475569;border-collapse:collapse;">
            <tr><td style="padding:4px 0"><strong>Title</strong></td><td>{safe_title}</td></tr>
            <tr><td style="padding:4px 0"><strong>Priority</strong></td><td>{safe_priority}</td></tr>
            <tr><td style="padding:4px 0"><strong>Est. cost</strong></td><td>{safe_cost}</td></tr>
            <tr><td style="padding:4px 0"><strong>Location</strong></td><td>{safe_loc}</td></tr>
          </table>
          <p style="margin:12px 0 0;font-size:14px;color:#475569;"><strong>Description</strong><br/>{safe_desc}</p>
          {comments_html}
        </td></tr>
        <tr><td style="padding:8px 24px 24px;text-align:center;">
          <a href="{safe_approve}" style="display:inline-block;margin:4px 6px;padding:12px 20px;background:#059669;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Approve</a>
          <a href="{safe_reject}" style="display:inline-block;margin:4px 6px;padding:12px 20px;background:#e11d48;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Reject</a>
          <a href="{safe_review}" style="display:inline-block;margin:4px 6px;padding:12px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">View details</a>
        </td></tr>
        <tr><td style="padding:12px 24px 20px;font-size:12px;color:#64748b;border-top:1px solid #e2e8f0;">
          Use the buttons above. Do not reply to this message.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""

    msg = _build_message(
        subject=subject,
        from_addr=noreply,
        from_display=display,
        to_addrs=[to_email],
        text_body=text,
        html_body=html_body,
    )
    try:
        await send_smtp_message(settings, msg)
        return True
    except Exception:
        _log.exception("SMTP planning approval failed to=%s", to_email)
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


async def send_inventory_low_stock_alert_email(
    settings: Settings,
    *,
    to_emails: list[str],
    company_name: str,
    item_name: str,
    sku: str,
    current_qty: float,
    minimum_qty: float,
    unit: str,
    vendor: str | None,
    suggested_reorder_qty: float | None,
    return_error_detail: bool = False,
) -> bool | tuple[bool, str | None]:
    smtp_err = outbound_smtp_configuration_error(settings)
    if smtp_err:
        if return_error_detail:
            return False, smtp_err
        return False
    if not to_emails:
        if return_error_detail:
            return False, "No recipient emails configured"
        return False

    display = settings.email_from_display.strip() or "Helix Systems"
    unit_label = f" {unit}".strip() if unit and unit != "count" else ""
    reorder_line = ""
    if suggested_reorder_qty is not None and suggested_reorder_qty > 0:
        reorder_line = f"\nSuggested reorder quantity: {suggested_reorder_qty:g}{unit_label}\n"

    vendor_line = f"\nVendor: {vendor}\n" if vendor and vendor.strip() else ""

    subject = f"[{company_name}] Low stock — {item_name} ({sku})"
    text = (
        f"Inventory alert for {company_name}\n\n"
        f"Item: {item_name}\n"
        f"SKU: {sku}\n"
        f"Current quantity: {current_qty:g}{unit_label}\n"
        f"Minimum level: {minimum_qty:g}{unit_label}\n"
        f"{vendor_line}"
        f"{reorder_line}\n"
        "This item was added to the Material Request queue in Pulse.\n"
        "Review inventory in Pulse → Material requests or Inventory.\n"
    )

    safe_name = html.escape(item_name, quote=True)
    safe_sku = html.escape(sku, quote=True)
    safe_co = html.escape(company_name, quote=True)

    html_body = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /></head>
<body style="font-family:system-ui,sans-serif;line-height:1.5;color:#1e293b;">
  <h2 style="color:#b45309;">Low stock alert</h2>
  <p><strong>{safe_co}</strong></p>
  <table style="border-collapse:collapse;margin:16px 0;">
    <tr><td style="padding:4px 12px 4px 0;font-weight:600;">Item</td><td>{safe_name}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;font-weight:600;">SKU</td><td>{safe_sku}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;font-weight:600;">Current qty</td><td>{current_qty:g}{html.escape(unit_label)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;font-weight:600;">Minimum</td><td>{minimum_qty:g}{html.escape(unit_label)}</td></tr>
  </table>
  <p style="font-size:14px;color:#64748b;">Open Pulse → Material requests to build a purchase draft.</p>
</body></html>"""

    msg = _build_message(
        subject=subject,
        from_addr=settings.email_from_noreply,
        from_display=display,
        to_addrs=to_emails,
        text_body=text,
        html_body=html_body,
    )
    try:
        await send_smtp_message(settings, msg)
        if return_error_detail:
            return True, None
        return True
    except Exception as exc:
        _log.exception("SMTP inventory low stock alert failed sku=%s", sku)
        if return_error_detail:
            return False, f"SMTP send failed: {exc}"
        return False


async def send_material_request_export_email(
    settings: Settings,
    *,
    to_emails: list[str],
    company_name: str,
    project: str,
    location: str,
    file_name: str,
    file_bytes: bytes,
    item_count: int,
    exported_by: str | None = None,
) -> bool:
    if not settings.smtp_configured or not to_emails or not file_bytes:
        return False

    display = settings.email_from_display.strip() or "Helix Systems"
    by_line = f"\nExported by: {exported_by}\n" if exported_by and exported_by.strip() else ""
    subject = f"[{company_name}] Material request — {project}"
    text = (
        f"Material request spreadsheet for {company_name}\n\n"
        f"Project: {project}\n"
        f"Location: {location}\n"
        f"Line items: {item_count}\n"
        f"{by_line}\n"
        f"The Excel file is attached ({file_name}).\n"
    )

    safe_co = html.escape(company_name, quote=True)
    safe_project = html.escape(project, quote=True)
    safe_location = html.escape(location, quote=True)
    html_body = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /></head>
<body style="font-family:system-ui,sans-serif;line-height:1.5;color:#1e293b;">
  <h2 style="color:#2B4C7E;">Material request export</h2>
  <p><strong>{safe_co}</strong></p>
  <ul>
    <li><strong>Project:</strong> {safe_project}</li>
    <li><strong>Location:</strong> {safe_location}</li>
    <li><strong>Items:</strong> {item_count}</li>
  </ul>
  <p style="font-size:14px;color:#64748b;">See attached spreadsheet ({html.escape(file_name, quote=True)}).</p>
</body></html>"""

    msg = MIMEMultipart("mixed")
    msg["Subject"] = subject
    msg["From"] = f"{display} <{settings.email_from_noreply}>"
    msg["To"] = ", ".join(to_emails)

    alt = MIMEMultipart("alternative")
    alt.attach(MIMEText(text, "plain", "utf-8"))
    alt.attach(MIMEText(html_body, "html", "utf-8"))
    msg.attach(alt)

    attachment = MIMEBase(
        "application",
        "vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    attachment.set_payload(file_bytes)
    encoders.encode_base64(attachment)
    attachment.add_header("Content-Disposition", f'attachment; filename="{file_name}"')
    msg.attach(attachment)

    try:
        await send_smtp_message(settings, msg)
        return True
    except Exception:
        _log.exception("SMTP material request export failed project=%s", project)
        return False
