"""Outbound invite email helpers with SMTP validation and structured errors."""

from __future__ import annotations

import logging
from typing import Optional

from app.core.config import Settings
from app.core.email_smtp import (
    outbound_smtp_configuration_error,
    send_company_admin_invite,
    send_employee_invite,
    smtp_settings_log_extra,
)

_log = logging.getLogger(__name__)


def invite_failure_message(base: str, error: Optional[str]) -> str:
    if error:
        return f"{base}: {error}"
    return base


async def try_send_employee_invite_email(
    settings: Settings,
    *,
    tenant_id: str,
    to_email: str,
    company_name: str,
    invite_url: str,
    send_email: bool,
) -> tuple[Optional[bool], Optional[str]]:
    """
    Send a tenant employee invite when requested.

    Returns (invite_email_sent, invite_email_error).
    ``invite_email_sent`` is None when ``send_email`` is false.
    """
    if not send_email:
        return None, None

    smtp_err = outbound_smtp_configuration_error(settings)
    if smtp_err:
        _log.warning(
            "Invite email validation failed",
            extra={"tenant_id": tenant_id, "reason": smtp_err, "to_email": to_email},
        )
        return False, smtp_err

    _log.info(
        "Sending employee invite email",
        extra={
            "tenant_id": tenant_id,
            "to_email": to_email,
            **smtp_settings_log_extra(settings),
        },
    )
    sent, err = await send_employee_invite(
        settings,
        to_email=to_email,
        company_name=company_name,
        invite_url=invite_url,
        return_error_detail=True,
    )
    if not sent:
        reason = err or "SMTP send failed"
        _log.warning(
            "Invite email send failed",
            extra={"tenant_id": tenant_id, "reason": reason, "to_email": to_email},
        )
        return False, reason
    return True, None


async def try_send_company_admin_invite_email(
    settings: Settings,
    *,
    tenant_id: Optional[str],
    to_email: str,
    company_name: str,
    invite_url: str,
) -> tuple[bool, Optional[str]]:
    """Send a system company-admin invite. Returns (sent, error_detail)."""
    smtp_err = outbound_smtp_configuration_error(settings)
    if smtp_err:
        _log.warning(
            "Company admin invite email validation failed",
            extra={"tenant_id": tenant_id, "reason": smtp_err, "to_email": to_email},
        )
        return False, smtp_err

    _log.info(
        "Sending company admin invite email",
        extra={
            "tenant_id": tenant_id,
            "to_email": to_email,
            **smtp_settings_log_extra(settings),
        },
    )
    sent, err = await send_company_admin_invite(
        settings,
        to_email=to_email,
        company_name=company_name,
        invite_url=invite_url,
        return_error_detail=True,
    )
    if not sent:
        reason = err or "SMTP send failed"
        _log.warning(
            "Company admin invite email send failed",
            extra={"tenant_id": tenant_id, "reason": reason, "to_email": to_email},
        )
        return False, reason
    return True, None
