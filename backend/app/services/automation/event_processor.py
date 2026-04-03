"""
What this file does (simple explanation):

This part of the system is the **traffic director** for automation events that have already been
saved to the database. It looks at the event type and sends it to the right “brain” module.

In plain terms:
Think of each incoming report as a piece of mail. This file reads the label (event type) and
puts the letter into the correct inbox—proximity, maintenance, compliance, or timeline—not every
mailbox gets every letter.

Why this exists:
One entry point keeps wiring simple. New behavior becomes “register another handler,” instead of
spreading if/else trees across the API.

How the system works (step-by-step, when a proximity event is processed):

1. A gateway radio in the building detects mobile tags and sends an update to the server.
2. Enrichment figures out which real person and which real tool those tag addresses belong to.
3. Gateway arbitration picks **which gateway** to trust if several saw the same pair.
4. This file calls the proximity handler, which decides what the situation means (near/far, movement).
5. Further automation (such as a sign-out reminder) may run when the handler fires.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.automation_engine import AutomationEvent
from app.services.automation import gateway_arbitration
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
    """
    What this does:
        Chooses the correct handler for this saved event and runs it once—**or** stops early if
        gateway arbitration says “ignore this proximity message.”

    When this runs:
        After an event is written and (for most paths) enriched—same pipeline for HTTP ingest and
        internal events.

    Why this matters:
        Without a single dispatcher, proximity could run on messages the referee already rejected,
        which would undo the stability rules.
    """
    handler = _HANDLERS.get(event.event_type)
    if handler is None:
        return
    # Proximity must honor “which gateway wins” before we interpret distance or movement.
    if event.event_type == "proximity_update":
        arb = await gateway_arbitration.evaluate(db, event)
        if not arb.should_process:
            return
    await handler(db, event)
