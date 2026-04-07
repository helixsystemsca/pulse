"""Core platform routes: health and generic event ingestion."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.core.events.engine import event_engine
from app.core.events.types import DomainEvent
from app.core.user_roles import user_has_any_role
from app.models.domain import User, UserRole
from app.schemas.common import EventIngest

router = APIRouter(prefix="/core", tags=["core"])


@router.get("/health")
async def health(_user: Annotated[User, Depends(get_current_user)]) -> dict[str, str]:
    return {"status": "ok"}


@router.post("/ingest")
async def ingest_event(
    body: EventIngest,
    user: Annotated[User, Depends(get_current_user)],
) -> dict[str, Any]:
    if user_has_any_role(user, UserRole.system_admin) or user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ingest requires a company-scoped user",
        )
    ev = DomainEvent(
        event_type=body.event_type,
        company_id=str(user.company_id),
        entity_id=(body.payload or {}).get("entity_id"),
        metadata=body.payload,
        source_module=body.source or "ingest",
    )
    await event_engine.publish(ev)
    return {"accepted": True, "correlation_id": ev.correlation_id}
