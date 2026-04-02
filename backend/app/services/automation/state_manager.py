"""Load/save `automation_state_tracking` rows (Postgres upsert)."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.automation_engine import AutomationStateTracking


async def load_state(db: AsyncSession, company_id: str, entity_key: str) -> dict:
    q = await db.execute(
        select(AutomationStateTracking).where(
            AutomationStateTracking.company_id == company_id,
            AutomationStateTracking.entity_key == entity_key,
        )
    )
    row = q.scalar_one_or_none()
    if not row:
        return {}
    return dict(row.state or {})


async def save_state(db: AsyncSession, company_id: str, entity_key: str, state: dict) -> None:
    now = datetime.now(timezone.utc)
    pk = str(uuid4())
    stmt = insert(AutomationStateTracking).values(
        id=pk,
        company_id=company_id,
        entity_key=entity_key,
        state=state,
        updated_at=now,
    )
    stmt = stmt.on_conflict_do_update(
        constraint="uq_automation_state_company_entity",
        set_={
            "state": stmt.excluded.state,
            "updated_at": now,
        },
    )
    await db.execute(stmt)


# Preferred public names (same implementations)
get_state = load_state
update_state = save_state
