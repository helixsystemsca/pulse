from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import AuditLog


async def write_audit(
    db: AsyncSession,
    *,
    company_id: str,
    actor_user_id: str | None,
    action: str,
    entity_type: str,
    entity_id: str | None,
    payload: dict[str, Any] | None = None,
) -> None:
    row = AuditLog(
        company_id=company_id,
        actor_user_id=actor_user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        payload=payload or {},
    )
    db.add(row)
