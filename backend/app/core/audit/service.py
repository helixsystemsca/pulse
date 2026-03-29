"""Append-only audit log — never delete from application code."""

from __future__ import annotations

from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import AuditLog


async def record_audit(
    db: AsyncSession,
    *,
    action: str,
    actor_user_id: Optional[str] = None,
    company_id: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> None:
    db.add(
        AuditLog(
            actor_user_id=actor_user_id,
            company_id=company_id,
            action=action,
            metadata_=metadata or {},
        )
    )
    await db.flush()
