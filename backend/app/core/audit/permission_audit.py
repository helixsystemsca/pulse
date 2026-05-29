"""Dual-write permission / role changes to RBAC audit + security audit_logs."""

from __future__ import annotations

from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit.security_events import record_security_event
from app.core.rbac.audit_service import record_rbac_audit_event


async def record_permission_change(
    db: AsyncSession,
    *,
    action: str,
    actor_user_id: str,
    company_id: str | None,
    target_user_id: str | None = None,
    payload: dict[str, Any] | None = None,
    request_id: str | None = None,
) -> None:
    """Write to ``rbac_audit_events`` and ``audit_logs`` (security.* actions)."""
    await record_rbac_audit_event(
        db,
        company_id=company_id,
        actor_user_id=actor_user_id,
        action=action,
        target_user_id=target_user_id,
        payload=payload,
    )
    sec_action = action if action.startswith("security.") else f"security.{action}"
    await record_security_event(
        db,
        action=sec_action,
        actor_user_id=actor_user_id,
        company_id=company_id,
        metadata={**(payload or {}), "target_user_id": target_user_id},
        request_id=request_id,
    )
