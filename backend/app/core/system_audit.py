"""Append-only logs for internal system-admin actions."""

from __future__ import annotations

from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import SystemLog


async def record_system_log(
    db: AsyncSession,
    *,
    action: str,
    performed_by: Optional[str] = None,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> None:
    db.add(
        SystemLog(
            action=action,
            performed_by=performed_by,
            target_type=target_type,
            target_id=target_id,
            metadata_=metadata or {},
        )
    )
    await db.flush()
