"""Send a test inventory low-stock alert email (company profile)."""

from __future__ import annotations

import logging

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.email_smtp import (
    outbound_smtp_configuration_error,
    send_inventory_low_stock_alert_email,
    smtp_settings_log_extra,
)
from app.core.operational_notifications import (
    _parse_email_list,
    inventory_low_stock_from_company,
)
from app.models.domain import Company

_log = logging.getLogger(__name__)


def _validation_failed(*, tenant_id: str, reason: str) -> None:
    _log.warning(
        "Low stock test email validation failed",
        extra={"tenant_id": tenant_id, "reason": reason},
    )
    raise HTTPException(status_code=400, detail=reason)


async def send_inventory_low_stock_test_email(
    db: AsyncSession,
    *,
    company_id: str,
    emails_override: str | None = None,
) -> dict:
    tenant_id = str(company_id)
    co = await db.get(Company, tenant_id)
    if not co:
        raise HTTPException(status_code=404, detail="Company not found")

    saved_cfg = inventory_low_stock_from_company(getattr(co, "operational_notifications", None))
    if emails_override is not None and str(emails_override).strip():
        recipients = _parse_email_list(emails_override)
        if not recipients:
            _validation_failed(
                tenant_id=tenant_id,
                reason="No valid recipient emails found. Use comma-separated addresses like user@example.com",
            )
    else:
        recipients = list(saved_cfg.emails)

    if not recipients:
        _validation_failed(
            tenant_id=tenant_id,
            reason="Add at least one recipient email before sending a test.",
        )

    settings = get_settings()
    smtp_err = outbound_smtp_configuration_error(settings)
    if smtp_err:
        _validation_failed(tenant_id=tenant_id, reason=smtp_err)

    _log.info(
        "Sending low stock test email",
        extra={
            "tenant_id": tenant_id,
            **smtp_settings_log_extra(settings),
            "recipient_count": len(recipients),
        },
    )

    sent, send_err = await send_inventory_low_stock_alert_email(
        settings,
        to_emails=recipients,
        company_name=co.name or "Your organization",
        item_name="Test item (no stock change)",
        sku="TEST-LOW-STOCK",
        current_qty=1,
        minimum_qty=5,
        unit="each",
        vendor=None,
        suggested_reorder_qty=10,
        return_error_detail=True,
    )
    if not sent:
        reason = send_err or "SMTP send failed. Check server logs for the underlying error."
        if reason.startswith("SMTP network connection failed"):
            _log.warning(
                "Low stock test email network failure",
                extra={"tenant_id": tenant_id, "reason": reason},
            )
            raise HTTPException(status_code=503, detail=reason)
        _validation_failed(tenant_id=tenant_id, reason=reason)

    return {"sent": True, "to": recipients}
