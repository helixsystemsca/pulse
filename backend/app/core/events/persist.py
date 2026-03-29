"""Persist domain events for audit, replay, and analytics."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.events.types import DomainEvent
from app.models.domain import DomainEventRow


async def persist_domain_event(db: AsyncSession, event: DomainEvent) -> None:
    row = DomainEventRow(
        company_id=event.company_id,
        event_type=event.event_type,
        entity_id=event.entity_id,
        payload=event.metadata,
        source_module=event.source_module,
        correlation_id=event.correlation_id,
        created_at=event.occurred_at,
    )
    db.add(row)
