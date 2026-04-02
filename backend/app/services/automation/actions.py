"""Side effects for automation: notifications + domain events."""

from __future__ import annotations

from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.automation_engine import AutomationNotification
from app.models.domain import DomainEventRow


async def create_notification(
    db: AsyncSession,
    *,
    user_id: str,
    company_id: str,
    ntype: str,
    payload: dict[str, Any],
    status: str = "pending",
) -> AutomationNotification:
    row = AutomationNotification(
        user_id=user_id,
        company_id=company_id,
        type=ntype,
        payload=payload,
        status=status,
    )
    db.add(row)
    await db.flush()
    return row


async def emit_automation_triggered(
    db: AsyncSession,
    *,
    company_id: str,
    entity_id: Optional[str],
    payload: dict[str, Any],
    correlation_id: Optional[str] = None,
) -> DomainEventRow:
    row = DomainEventRow(
        company_id=company_id,
        event_type="automation_triggered",
        entity_id=entity_id,
        payload=payload,
        source_module="automation",
        correlation_id=correlation_id,
    )
    db.add(row)
    await db.flush()
    return row
