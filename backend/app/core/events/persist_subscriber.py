"""Background persistence: every published domain event is stored for audit and analytics."""

import logging

from app.core.database import AsyncSessionLocal
from app.core.events.engine import event_engine
from app.core.events.persist import persist_domain_event
from app.core.events.types import DomainEvent

logger = logging.getLogger(__name__)
_persist_attached = False


async def _persist_handler(event: DomainEvent) -> None:
    try:
        async with AsyncSessionLocal() as session:
            await persist_domain_event(session, event)
            await session.commit()
    except Exception:
        logger.exception("Failed to persist domain event %s", event.event_type)


def attach_persist_subscriber() -> None:
    global _persist_attached
    if _persist_attached:
        return
    event_engine.subscribe("*", _persist_handler)
    _persist_attached = True
