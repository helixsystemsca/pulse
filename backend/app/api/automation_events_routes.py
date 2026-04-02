"""POST automation events — persist then run in-process processor."""

from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.automation_engine import AutomationEvent
from app.models.domain import User, UserRole
from app.schemas.automation_engine import AutomationEventAccepted, AutomationEventIn
from app.services.automation.event_enricher import enrich_event
from app.services.automation.event_processor import process_event
from app.services.automation.ingest_helpers import build_idempotency_key, find_event_by_idempotency
from app.services.automation.logging_service import log_event

router = APIRouter(prefix="/events", tags=["automation-events"])


def _resolve_company_id(user: User, body_company: Optional[str]) -> str:
    if user.role == UserRole.system_admin:
        if not body_company:
            raise HTTPException(
                status_code=400,
                detail="company_id is required in payload for system administrators",
            )
        return str(body_company)
    if not user.company_id:
        raise HTTPException(status_code=403, detail="Company context required")
    return str(user.company_id)


@router.post("", response_model=AutomationEventAccepted)
async def ingest_event(
    body: AutomationEventIn,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> AutomationEventAccepted:
    payload = body.model_dump()
    canonical_company = _resolve_company_id(user, payload.get("company_id"))
    payload["company_id"] = canonical_company

    idem = build_idempotency_key(payload)
    existing = await find_event_by_idempotency(db, company_id=canonical_company, idempotency_key=idem)
    if existing is not None:
        await log_event(
            db,
            company_id=canonical_company,
            log_type="deduplicated",
            message="skipped duplicate idempotency_key",
            payload={"idempotency_key": idem, "existing_event_id": existing.id},
            severity="info",
            source_module="ingest",
        )
        await db.commit()
        return AutomationEventAccepted(id=existing.id, deduplicated=True)

    row = AutomationEvent(
        company_id=canonical_company,
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
