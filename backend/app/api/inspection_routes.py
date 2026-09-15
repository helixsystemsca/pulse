"""Field inspections API — persist runs and create corrective work requests."""

from __future__ import annotations

from typing import Annotated, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_any_rbac, require_tenant_user
from app.models.domain import User
from app.services import inspection_service as svc

router = APIRouter(prefix="/inspections", tags=["inspections"])

Db = Annotated[AsyncSession, Depends(get_db)]
CompanyId = Annotated[str, Depends(lambda u=Depends(require_tenant_user): str(u.company_id))]
Actor = Annotated[User, Depends(require_tenant_user)]
Reader = Annotated[
    User,
    Depends(
        require_any_rbac(
            "compliance.view",
            "compliance.manage",
            "work_requests.view",
            "work_requests.edit",
            "recreation_ops.view",
            "recreation_ops.manage",
        )
    ),
]
Editor = Annotated[
    User,
    Depends(
        require_any_rbac(
            "compliance.manage",
            "work_requests.view",
            "work_requests.edit",
            "recreation_ops.manage",
        )
    ),
]


class InspectionItemIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=512)
    result: Optional[str] = None
    notes: Optional[str] = None
    evidence: list[Any] = Field(default_factory=list)
    sort_order: int = 0


class InspectionRunCreateIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=512)
    template_key: Optional[str] = None
    template_type: Optional[str] = None
    overall_result: Optional[str] = None
    facility_id: Optional[str] = None
    equipment_id: Optional[str] = None
    zone_id: Optional[str] = None
    notes: Optional[str] = None
    evidence: list[Any] = Field(default_factory=list)
    values: dict[str, Any] = Field(default_factory=dict)
    items: list[InspectionItemIn] = Field(default_factory=list)


@router.get("/runs")
async def list_runs(db: Db, cid: CompanyId, _: Reader, limit: int = Query(50, ge=1, le=200)) -> dict[str, Any]:
    rows = await svc.list_runs(db, cid, limit=limit)
    return {"items": [svc.serialize_run(r) for r in rows]}


@router.get("/runs/{run_id}")
async def get_run(run_id: str, db: Db, cid: CompanyId, _: Reader) -> dict[str, Any]:
    row = await svc.get_run(db, cid, run_id)
    if not row:
        raise HTTPException(status_code=404, detail="Inspection not found")
    return svc.serialize_run(row)


@router.post("/runs", status_code=status.HTTP_201_CREATED)
async def create_run(body: InspectionRunCreateIn, db: Db, cid: CompanyId, actor: Editor) -> dict[str, Any]:
    row = await svc.create_run(db, cid, str(actor.id), body.model_dump())
    await db.commit()
    loaded = await svc.get_run(db, cid, str(row.id))
    assert loaded is not None
    return svc.serialize_run(loaded)


@router.post("/runs/{run_id}/items/{item_id}/corrective-action", status_code=status.HTTP_201_CREATED)
async def create_corrective(
    run_id: str,
    item_id: str,
    db: Db,
    cid: CompanyId,
    actor: Editor,
) -> dict[str, Any]:
    run, wr = await svc.corrective_for_item(db, cid, str(actor.id), run_id, item_id)
    await db.commit()
    loaded = await svc.get_run(db, cid, str(run.id))
    assert loaded is not None
    return {
        "inspection": svc.serialize_run(loaded),
        "work_request_id": str(wr.id),
        "work_order_number": wr.work_order_number,
        "href": "/dashboard/maintenance",
    }
