"""Inventory low-stock email alerts (tenant-configured recipients)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.email_smtp import send_inventory_low_stock_alert_email
from app.core.operational_notifications import inventory_low_stock_from_company
from app.models.domain import Company, InventoryItem, InventoryModuleSettings
from app.services.inventory_notifications import notifications_from_settings

_log = logging.getLogger(__name__)

_LOW_STOCK_NOTIFIED_KEY = "_pulse_low_stock_notified"


def _inventory_alerts_enabled(settings: Optional[dict[str, Any]]) -> bool:
    if not settings:
        return True
    alerts = settings.get("alerts")
    if not isinstance(alerts, dict):
        return True
    return alerts.get("low_stock", True) is not False


async def _load_inventory_settings(db: AsyncSession, company_id: str) -> dict[str, Any]:
    q = await db.execute(
        select(InventoryModuleSettings).where(InventoryModuleSettings.company_id == company_id)
    )
    row = q.scalar_one_or_none()
    return dict(row.settings) if row and isinstance(row.settings, dict) else {}


async def resolve_low_stock_alert_targets(
    db: AsyncSession, company_id: str
) -> tuple[bool, list[str]]:
    co = await db.get(Company, company_id)
    if not co:
        return False, []
    inv_settings = await _load_inventory_settings(db, company_id)
    if not _inventory_alerts_enabled(inv_settings):
        return False, []
    notif = notifications_from_settings(inv_settings)
    if notif.email_directory and notif.low_stock_enabled and notif.low_stock_emails:
        recipients = notif.low_stock_emails
    else:
        cfg = inventory_low_stock_from_company(getattr(co, "operational_notifications", None))
        if not cfg.enabled or not cfg.emails:
            return False, []
        recipients = cfg.emails
    settings = get_settings()
    if not settings.smtp_configured:
        return False, []
    return True, recipients


def _was_notified(item: InventoryItem) -> bool:
    attrs = item.custom_attributes if isinstance(item.custom_attributes, dict) else {}
    return bool(attrs.get(_LOW_STOCK_NOTIFIED_KEY))


def _set_notified(item: InventoryItem, notified: bool) -> None:
    attrs = dict(item.custom_attributes) if isinstance(item.custom_attributes, dict) else {}
    if notified:
        attrs[_LOW_STOCK_NOTIFIED_KEY] = datetime.now(timezone.utc).isoformat()
    else:
        attrs.pop(_LOW_STOCK_NOTIFIED_KEY, None)
    item.custom_attributes = attrs


async def maybe_send_low_stock_alert(
    db: AsyncSession,
    item: InventoryItem,
    *,
    is_low: bool,
) -> None:
    """Email once per low-stock stint (until quantity goes back above minimum)."""
    if not is_low:
        _set_notified(item, False)
        return

    if _was_notified(item):
        return

    ok, recipients = await resolve_low_stock_alert_targets(db, item.company_id)
    if not ok:
        return

    settings = get_settings()
    co = await db.get(Company, item.company_id)
    company_name = co.name if co else "Your organization"
    reorder = None
    minimum = float(item.low_stock_threshold or 0)
    maximum = float(item.maximum_qty) if item.maximum_qty is not None else None
    if maximum is not None and maximum > float(item.quantity or 0):
        reorder = maximum - float(item.quantity or 0)
    elif minimum > 0:
        reorder = minimum * 2.0

    sent = await send_inventory_low_stock_alert_email(
        settings,
        to_emails=recipients,
        company_name=company_name,
        item_name=item.name,
        sku=item.sku,
        current_qty=float(item.quantity or 0),
        minimum_qty=minimum,
        unit=item.unit or "",
        vendor=item.vendor,
        suggested_reorder_qty=reorder,
    )
    if sent:
        _set_notified(item, True)
        _log.info(
            "Low stock alert emailed for item %s (%s) to %s",
            item.id,
            item.sku,
            ", ".join(recipients),
        )
