"""Route persisted `AutomationEvent` rows to developer-owned logic modules."""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.automation_engine import AutomationEvent
from app.services.automation.logic import compliance_logic, maintenance_logic, proximity_logic, timeline_logic

Handler = Callable[[AsyncSession, AutomationEvent], Awaitable[None]]

_HANDLERS: dict[str, Handler] = {
    "proximity_update": proximity_logic.handle,
    "compliance_signal": compliance_logic.handle,
    "maintenance_signal": maintenance_logic.handle,
    "session_started": timeline_logic.handle,
    "session_ended": timeline_logic.handle,
    "notification_acknowledged": timeline_logic.handle,
}


async def process_event(db: AsyncSession, event: AutomationEvent) -> None:
    handler = _HANDLERS.get(event.event_type)
    if handler is None:
        return
    await handler(db, event)
