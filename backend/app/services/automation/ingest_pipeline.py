"""Shared HTTP ingest path for automation events (JWT users and gateway device auth)."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.automation_engine import AutomationEvent
from app.schemas.automation_engine import AutomationEventAccepted, AutomationEventIn
from app.services.automation.event_enricher import enrich_event
from app.services.automation.event_processor import process_event
from app.services.automation.ingest_helpers import build_idempotency_key, find_event_by_idempotency
from app.services.automation.logging_service import log_event


async def ingest_automation_event(
    db: AsyncSession,
    *,
    company_id: str,
    body: AutomationEventIn,
) -> AutomationEventAccepted:
    payload = body.model_dump()
    payload["company_id"] = company_id

    idem = build_idempotency_key(payload)
    existing = await find_event_by_idempotency(db, company_id=company_id, idempotency_key=idem)
    if existing is not None:
        await log_event(
            db,
            company_id=company_id,
            log_type="deduplicated",
            message="skipped duplicate idempotency_key",
            payload={"idempotency_key": idem, "existing_event_id": existing.id},
            severity="info",
            source_module="ingest",
        )
        await db.commit()
        return AutomationEventAccepted(id=existing.id, deduplicated=True)

    row = AutomationEvent(
        company_id=company_id,
        event_type=str(payload["event_type"]),
        payload=payload,
        idempotency_key=idem,
    )
    db.add(row)
    await db.flush()
    enrich_result = await enrich_event(db, row)
    if enrich_result.process:
        await process_event(db, row)
    await db.commit()
    await db.refresh(row)
    return AutomationEventAccepted(id=row.id, rate_limited=enrich_result.rate_limited)
