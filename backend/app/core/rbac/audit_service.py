"""Persist RBAC-related audit events (mutations, high-value overrides)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.rbac_models import RbacAuditEvent


async def record_rbac_audit_event(
    db: AsyncSession,
    *,
    company_id: str | None,
    actor_user_id: str,
    action: str,
    target_user_id: str | None = None,
    payload: dict[str, Any] | None = None,
) -> None:
    row = RbacAuditEvent(
        id=str(uuid4()),
        company_id=company_id,
        actor_user_id=actor_user_id,
        action=action,
        target_user_id=target_user_id,
        payload=payload,
        created_at=datetime.now(timezone.utc),
    )
    db.add(row)
    await db.flush()
