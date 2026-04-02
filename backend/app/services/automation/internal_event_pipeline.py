"""Create automation_events from server-side workflows (timeline, acknowledgements, etc.)."""

from __future__ import annotations

from typing import Any
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.automation_engine import AutomationEvent
from app.services.automation.event_enricher import enrich_event
from app.services.automation.event_processor import process_event


async def ingest_internal_event(
    db: AsyncSession,
    *,
    company_id: str,
    event_type: str,
    payload: dict[str, Any],
) -> AutomationEvent:
    """Persist, enrich, and process (same pipeline as HTTP ingest; unique idempotency per call)."""
    cid = str(company_id).strip()
    body = {**payload, "company_id": cid}
    row = AutomationEvent(
        company_id=cid,
        event_type=str(event_type),
        payload=body,
        idempotency_key=f"internal:{event_type}:{uuid4()}",
    )
    db.add(row)
    await db.flush()
    enrich_result = await enrich_event(db, row)
    if enrich_result.process:
        await process_event(db, row)
    return row
