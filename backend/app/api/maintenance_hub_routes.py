"""Tenant Maintenance hub — work orders (backed by pulse_work_requests), procedures, preventative rules."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_tenant_user
from app.core.database import get_db
from app.models.domain import User, Zone
from app.models.pulse_models import (
    PulsePreventativeRule,
    PulseProcedure,
    PulseWorkOrderType,
    PulseWorkRequest,
    PulseWorkRequestPriority,
    PulseWorkRequestStatus,
)
from app.modules.pulse import service as pulse_svc
from app.schemas.maintenance_hub import (
    PreventativeRuleCreate,
    PreventativeRuleOut,
    PreventativeRuleUpdate,
    ProcedureCreate,
    ProcedureOut,
    ProcedureUpdate,
    WorkOrderCreate,
    WorkOrderDetailOut,
    WorkOrderOut,
    WorkOrderUpdate,
    WorkOrderStatusApi,
    WorkOrderType,
)

router = APIRouter(prefix="/cmms", tags=["maintenance-hub"])


async def _company_id(user: User = Depends(require_tenant_user)) -> str:
    if user.company_id is None:
        raise HTTPException(status_code=403, detail="Company context required")
    return str(user.company_id)


CompanyId = Annotated[str, Depends(_company_id)]
Db = Annotated[AsyncSession, Depends(get_db)]


def _asset_id_from_row(wr: PulseWorkRequest) -> Optional[str]:
    if wr.equipment_id:
        return str(wr.equipment_id)
    if wr.tool_id:
        return str(wr.tool_id)
    return None


def _apply_asset_id(wr: PulseWorkRequest, asset_id: Optional[str]) -> None:
    wr.equipment_id = None
    wr.tool_id = None
    if not asset_id:
        return
    # Prefer treating asset_id as facility equipment when it matches
    wr.equipment_id = asset_id


def _wo_status_str(s: PulseWorkRequestStatus) -> WorkOrderStatusApi:
    v = s.value if hasattr(s, "value") else str(s)
    if v in ("open", "in_progress", "completed", "cancelled"):
        return v  # type: ignore[return-value]
    return "open"


def _wo_type_str(t: PulseWorkOrderType) -> WorkOrderType:
    v = t.value if hasattr(t, "value") else str(t)
    if v in ("issue", "preventative", "request"):
        return v  # type: ignore[return-value]
    return "issue"


def _parse_wo_status(v: str) -> PulseWorkRequestStatus:
    try:
        return PulseWorkRequestStatus(v)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid status: {v}") from None


def row_to_work_order_out(wr: PulseWorkRequest) -> WorkOrderOut:
    return WorkOrderOut(
        id=str(wr.id),
        type=_wo_type_str(wr.work_order_type),
        title=wr.title,
        asset_id=_asset_id_from_row(wr),
        procedure_id=str(wr.procedure_id) if wr.procedure_id else None,
        status=_wo_status_str(wr.status),
        due_date=wr.due_date,
        created_at=wr.created_at,
        description=wr.description,
        zone_id=str(wr.zone_id) if wr.zone_id else None,
        equipment_id=str(wr.equipment_id) if wr.equipment_id else None,
        tool_id=str(wr.tool_id) if wr.tool_id else None,
    )


def rule_to_out(r: PulsePreventativeRule) -> PreventativeRuleOut:
    return PreventativeRuleOut(
        id=str(r.id),
        company_id=str(r.company_id),
        asset_id=str(r.equipment_id),
        frequency=r.frequency,
        procedure_id=str(r.procedure_id) if r.procedure_id else None,
        created_at=r.created_at,
        updated_at=r.updated_at,
    )


# —— Work orders ——


@router.get("/work-orders", response_model=list[WorkOrderOut])
async def list_work_orders(
    db: Db,
    cid: CompanyId,
    type: Optional[str] = Query(None, description="issue | preventative | request"),
    limit: int = Query(100, ge=1, le=300),
    offset: int = Query(0, ge=0),
) -> list[WorkOrderOut]:
    conds = [PulseWorkRequest.company_id == cid]
    if type:
        try:
            conds.append(PulseWorkRequest.work_order_type == PulseWorkOrderType(type))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid type filter") from None
    q = (
        await db.execute(
            select(PulseWorkRequest)
            .where(and_(*conds))
            .order_by(PulseWorkRequest.updated_at.desc())
            .offset(offset)
            .limit(limit)
        )
    ).scalars().all()
    return [row_to_work_order_out(r) for r in q]


@router.get("/work-orders/{work_order_id}", response_model=WorkOrderDetailOut)
async def get_work_order(db: Db, cid: CompanyId, work_order_id: str) -> WorkOrderDetailOut:
    wr = await db.get(PulseWorkRequest, work_order_id)
    if not wr or wr.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    proc: ProcedureOut | None = None
    if wr.procedure_id:
        p = await db.get(PulseProcedure, wr.procedure_id)
        if p and p.company_id == cid:
            proc = ProcedureOut.model_validate(p)
    base = row_to_work_order_out(wr).model_dump()
    return WorkOrderDetailOut(**base, procedure=proc)


@router.post("/work-orders", response_model=WorkOrderOut, status_code=status.HTTP_201_CREATED)
async def create_work_order(
    db: Db,
    cid: CompanyId,
    body: WorkOrderCreate,
    user: User = Depends(require_tenant_user),
) -> WorkOrderOut:
    ot = PulseWorkOrderType(body.type)
    st = _parse_wo_status(body.status)
    wr = PulseWorkRequest(
        company_id=cid,
        title=body.title,
        description=body.description,
        zone_id=body.zone_id,
        work_order_type=ot,
        procedure_id=body.procedure_id,
        status=st,
        due_date=body.due_date,
        created_by_user_id=user.id,
        priority=PulseWorkRequestPriority.medium,
        attachments=[],
    )
    _apply_asset_id(wr, body.asset_id)
    if wr.equipment_id and not await pulse_svc.facility_equipment_in_company(db, cid, wr.equipment_id):
        raise HTTPException(status_code=400, detail="Unknown equipment for asset_id")
    if wr.zone_id:
        zq = await db.execute(select(Zone.id).where(Zone.id == wr.zone_id, Zone.company_id == cid))
        if zq.scalar_one_or_none() is None:
            raise HTTPException(status_code=400, detail="Unknown zone")
    if wr.procedure_id:
        pr = await db.get(PulseProcedure, wr.procedure_id)
        if not pr or pr.company_id != cid:
            raise HTTPException(status_code=400, detail="Unknown procedure")
    if st == PulseWorkRequestStatus.completed:
        wr.completed_at = datetime.now(timezone.utc)
    db.add(wr)
    await db.commit()
    await db.refresh(wr)
    return row_to_work_order_out(wr)


@router.patch("/work-orders/{work_order_id}", response_model=WorkOrderOut)
async def update_work_order(
    db: Db,
    cid: CompanyId,
    work_order_id: str,
    body: WorkOrderUpdate,
) -> WorkOrderOut:
    wr = await db.get(PulseWorkRequest, work_order_id)
    if not wr or wr.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    data = body.model_dump(exclude_unset=True)
    if "type" in data:
        wr.work_order_type = PulseWorkOrderType(data["type"])
    if "title" in data:
        wr.title = data["title"]
    if "description" in data:
        wr.description = data["description"]
    if "zone_id" in data:
        zid = data["zone_id"]
        if zid:
            zq = await db.execute(select(Zone.id).where(Zone.id == zid, Zone.company_id == cid))
            if zq.scalar_one_or_none() is None:
                raise HTTPException(status_code=400, detail="Unknown zone")
        wr.zone_id = zid
    if "asset_id" in data:
        _apply_asset_id(wr, data["asset_id"])
        if wr.equipment_id and not await pulse_svc.facility_equipment_in_company(db, cid, wr.equipment_id):
            raise HTTPException(status_code=400, detail="Unknown equipment for asset_id")
    if "procedure_id" in data:
        pid = data["procedure_id"]
        if pid:
            pr = await db.get(PulseProcedure, pid)
            if not pr or pr.company_id != cid:
                raise HTTPException(status_code=400, detail="Unknown procedure")
        wr.procedure_id = pid
    if "due_date" in data:
        wr.due_date = data["due_date"]
    if "status" in data:
        st = _parse_wo_status(data["status"])
        wr.status = st
        if st == PulseWorkRequestStatus.completed:
            wr.completed_at = datetime.now(timezone.utc)
        elif st != PulseWorkRequestStatus.completed:
            wr.completed_at = None
    wr.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(wr)
    return row_to_work_order_out(wr)


@router.delete("/work-orders/{work_order_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_work_order(db: Db, cid: CompanyId, work_order_id: str) -> None:
    wr = await db.get(PulseWorkRequest, work_order_id)
    if not wr or wr.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    await db.execute(delete(PulseWorkRequest).where(PulseWorkRequest.id == wr.id))
    await db.commit()


# —— Procedures ——


@router.get("/procedures", response_model=list[ProcedureOut])
async def list_procedures(db: Db, cid: CompanyId) -> list[ProcedureOut]:
    q = await db.execute(
        select(PulseProcedure).where(PulseProcedure.company_id == cid).order_by(PulseProcedure.title)
    )
    return [ProcedureOut.model_validate(r) for r in q.scalars().all()]


@router.post("/procedures", response_model=ProcedureOut, status_code=status.HTTP_201_CREATED)
async def create_procedure(db: Db, cid: CompanyId, body: ProcedureCreate) -> ProcedureOut:
    row = PulseProcedure(company_id=cid, title=body.title.strip(), steps=list(body.steps))
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return ProcedureOut.model_validate(row)


@router.get("/procedures/{procedure_id}", response_model=ProcedureOut)
async def get_procedure(db: Db, cid: CompanyId, procedure_id: str) -> ProcedureOut:
    row = await db.get(PulseProcedure, procedure_id)
    if not row or row.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    return ProcedureOut.model_validate(row)


@router.patch("/procedures/{procedure_id}", response_model=ProcedureOut)
async def update_procedure(
    db: Db, cid: CompanyId, procedure_id: str, body: ProcedureUpdate
) -> ProcedureOut:
    row = await db.get(PulseProcedure, procedure_id)
    if not row or row.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    if body.title is not None:
        row.title = body.title.strip()
    if body.steps is not None:
        row.steps = list(body.steps)
    row.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(row)
    return ProcedureOut.model_validate(row)


@router.delete("/procedures/{procedure_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_procedure(db: Db, cid: CompanyId, procedure_id: str) -> None:
    row = await db.get(PulseProcedure, procedure_id)
    if not row or row.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    await db.execute(delete(PulseProcedure).where(PulseProcedure.id == row.id))
    await db.commit()


# —— Preventative ——


@router.get("/preventative", response_model=list[PreventativeRuleOut])
async def list_preventative(db: Db, cid: CompanyId) -> list[PreventativeRuleOut]:
    q = await db.execute(
        select(PulsePreventativeRule)
        .where(PulsePreventativeRule.company_id == cid)
        .order_by(PulsePreventativeRule.updated_at.desc())
    )
    return [rule_to_out(r) for r in q.scalars().all()]


@router.post("/preventative", response_model=PreventativeRuleOut, status_code=status.HTTP_201_CREATED)
async def create_preventative(db: Db, cid: CompanyId, body: PreventativeRuleCreate) -> PreventativeRuleOut:
    if not await pulse_svc.facility_equipment_in_company(db, cid, body.asset_id):
        raise HTTPException(status_code=400, detail="Unknown asset_id (equipment)")
    if body.procedure_id:
        pr = await db.get(PulseProcedure, body.procedure_id)
        if not pr or pr.company_id != cid:
            raise HTTPException(status_code=400, detail="Unknown procedure")
    row = PulsePreventativeRule(
        company_id=cid,
        equipment_id=body.asset_id,
        frequency=body.frequency.strip(),
        procedure_id=body.procedure_id,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return rule_to_out(row)


@router.get("/preventative/{rule_id}", response_model=PreventativeRuleOut)
async def get_preventative(db: Db, cid: CompanyId, rule_id: str) -> PreventativeRuleOut:
    row = await db.get(PulsePreventativeRule, rule_id)
    if not row or row.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    return rule_to_out(row)


@router.patch("/preventative/{rule_id}", response_model=PreventativeRuleOut)
async def update_preventative(
    db: Db, cid: CompanyId, rule_id: str, body: PreventativeRuleUpdate
) -> PreventativeRuleOut:
    row = await db.get(PulsePreventativeRule, rule_id)
    if not row or row.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    if body.asset_id is not None:
        if not await pulse_svc.facility_equipment_in_company(db, cid, body.asset_id):
            raise HTTPException(status_code=400, detail="Unknown asset_id")
        row.equipment_id = body.asset_id
    if body.frequency is not None:
        row.frequency = body.frequency.strip()
    if body.procedure_id is not None:
        if body.procedure_id:
            pr = await db.get(PulseProcedure, body.procedure_id)
            if not pr or pr.company_id != cid:
                raise HTTPException(status_code=400, detail="Unknown procedure")
        row.procedure_id = body.procedure_id
    row.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(row)
    return rule_to_out(row)


@router.delete("/preventative/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_preventative(db: Db, cid: CompanyId, rule_id: str) -> None:
    row = await db.get(PulsePreventativeRule, rule_id)
    if not row or row.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    await db.execute(delete(PulsePreventativeRule).where(PulsePreventativeRule.id == row.id))
    await db.commit()
