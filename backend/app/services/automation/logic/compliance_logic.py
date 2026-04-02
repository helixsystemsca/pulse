"""Reserved module: compliance automation hooks (implemented incrementally)."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.automation_engine import AutomationEvent


async def handle(db: AsyncSession, event: AutomationEvent) -> None:
    _ = (db, event)
    return
