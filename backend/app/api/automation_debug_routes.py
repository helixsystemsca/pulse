"""Operational visibility: recent automation activity and per-entity state (manager+)."""

from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.api.devices_routes import resolve_devices_company_id
from app.schemas.api_common import ApiSuccess
from app.services.automation.operational_service import fetch_entity_state, fetch_recent_activity

router = APIRouter(prefix="/automation/debug", tags=["automation-debug"])

Db = Annotated[AsyncSession, Depends(get_db)]
CompanyId = Annotated[str, Depends(resolve_devices_company_id)]


@router.get("/recent-activity", response_model=ApiSuccess[dict])
async def automation_recent_activity(
    db: Db,
    company_id: CompanyId,
    limit: int = Query(50, ge=1, le=100, description="Max rows per bucket (events, logs, states)"),
) -> ApiSuccess[dict]:
    data = await fetch_recent_activity(db, company_id=company_id, limit=limit)
    return ApiSuccess(data=data, meta={"limit": limit})


@router.get("/state", response_model=ApiSuccess[dict])
async def automation_state_inspector(
    db: Db,
    company_id: CompanyId,
    worker_id: Optional[str] = Query(None, description="Worker UUID"),
    equipment_id: Optional[str] = Query(None, description="Equipment (tool) UUID"),
) -> ApiSuccess[dict]:
    data = await fetch_entity_state(
        db, company_id=company_id, worker_id=worker_id, equipment_id=equipment_id
    )
    return ApiSuccess(data=data)
