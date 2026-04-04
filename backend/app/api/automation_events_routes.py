"""POST automation events — persist then run in-process processor."""

from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.domain import User, UserRole
from app.schemas.automation_engine import AutomationEventAccepted, AutomationEventIn
from app.services.automation.ingest_pipeline import ingest_automation_event

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
    canonical_company = _resolve_company_id(user, body.model_dump().get("company_id"))
    return await ingest_automation_event(db, company_id=canonical_company, body=body)
