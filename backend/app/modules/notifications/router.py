"""
Notifications module: configurable rules; worker vs admin targeting.

Full evaluation hooks into the event bus can be added without importing other modules.
"""

from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_company_admin_scoped
from app.core.database import get_db
from app.core.events.engine import event_engine
from app.core.events.types import DomainEvent
from app.models.domain import TenantNotificationRule, User
from app.modules.notifications import MODULE_KEY
from app.modules.notifications.schemas import RuleCreate

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/rules")
async def list_rules(
    user: Annotated[User, Depends(require_company_admin_scoped)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[dict[str, Any]]:
    q = await db.execute(select(TenantNotificationRule).where(TenantNotificationRule.company_id == user.company_id))
    rows = q.scalars().all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "event_pattern": r.event_pattern,
            "target_role": r.target_role,
            "is_active": r.is_active,
        }
        for r in rows
    ]


@router.post("/rules")
async def create_rule(
    body: RuleCreate,
    user: Annotated[User, Depends(require_company_admin_scoped)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    row = TenantNotificationRule(
        company_id=user.company_id,
        name=body.name,
        event_pattern=body.event_pattern,
        target_role=body.target_role,
        config=body.config,
    )
    db.add(row)
    await db.flush()
    await event_engine.publish(
        DomainEvent(
            event_type="notifications.rule_created",
            company_id=user.company_id,
            entity_id=row.id,
            metadata={"rule_id": row.id},
            source_module=MODULE_KEY,
        )
    )
    await db.commit()
    return {"id": row.id}


@router.post("/test-dispatch")
async def test_dispatch(
    user: Annotated[User, Depends(require_company_admin_scoped)],
) -> dict[str, str]:
    """Emit a sample alert for UI wiring; replace with real rule engine."""
    await event_engine.publish(
        DomainEvent(
            event_type="notifications.alert",
            company_id=user.company_id,
            metadata={"message": "Test worker alert", "severity": "info"},
            source_module=MODULE_KEY,
        )
    )
    return {"queued": "true"}
