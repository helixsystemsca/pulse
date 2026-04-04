"""Pulse REST API — tenant-scoped CMMS, scheduling, inventory, beacons."""

from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import and_, delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_tenant_user
from app.services.onboarding_service import try_mark_onboarding_step
from app.core.database import get_db
from app.models.domain import InventoryItem, Tool, ToolStatus, User, UserRole, Zone
from app.models.pulse_models import (
    PulseBeaconEquipment,
    PulseProject,
    PulseProjectTask,
    PulseScheduleShift,
    PulseWorkRequest,
    PulseWorkRequestStatus,
    PulseWorkerProfile,
)
from app.modules.pulse import project_service as proj_task_svc
from app.modules.pulse import service as pulse_svc
from app.schemas.pulse import (
    AssetOut,
    AssetPatch,
    BeaconEquipmentCreate,
    BeaconEquipmentOut,
    BeaconEquipmentPatch,
    DashboardOut,
    InventoryItemOut,
    InventoryPatch,
    PhotoUploadOut,
    ShiftCreate,
    ShiftCreateResult,
    ShiftOut,
    ShiftUpdate,
    WorkRequestCreate,
    WorkRequestListOut,
    WorkRequestOut,
    WorkRequestUpdate,
    WorkerOut,
    WorkerProfilePatch,
    ZoneOut,
)

router = APIRouter(prefix="/pulse", tags=["pulse"])


async def _resolve_pulse_wr_part_equipment(
    db: AsyncSession, cid: str, part_id: Optional[str], equipment_id: Optional[str]
) -> tuple[Optional[str], Optional[str]]:
    if not part_id:
        return None, equipment_id
    part = await pulse_svc.equipment_part_for_company(db, cid, part_id)
    if not part:
        raise HTTPException(status_code=400, detail="Unknown part for this organization")
    if equipment_id and equipment_id != part.equipment_id:
        raise HTTPException(status_code=400, detail="Part does not belong to selected equipment")
    return part_id, equipment_id or part.equipment_id


def _shift_to_out(
    sh: PulseScheduleShift,
    task: Optional[PulseProjectTask] = None,
    project: Optional[PulseProject] = None,
) -> ShiftOut:
    sk = getattr(sh, "shift_kind", None) or "workforce"
    tp: Optional[str] = None
    if task is not None and task.priority is not None:
        tp = task.priority.value if hasattr(task.priority, "value") else str(task.priority)
    return ShiftOut(
        id=str(sh.id),
        company_id=str(sh.company_id),
        assigned_user_id=str(sh.assigned_user_id),
        zone_id=str(sh.zone_id) if sh.zone_id else None,
        starts_at=sh.starts_at,
        ends_at=sh.ends_at,
        shift_type=sh.shift_type,
        requires_supervisor=sh.requires_supervisor,
        requires_ticketed=sh.requires_ticketed,
        created_at=sh.created_at,
        shift_kind=sk,
        display_label=getattr(sh, "display_label", None),
        project_task_id=str(task.id) if task else None,
        project_id=str(project.id) if project else None,
        project_name=project.name if project else None,
        task_priority=tp,
    )


async def _company_id(user: User = Depends(require_tenant_user)) -> str:
    assert user.company_id is not None
    return str(user.company_id)


CompanyId = Annotated[str, Depends(_company_id)]
Db = Annotated[AsyncSession, Depends(get_db)]


async def _tool_in_company(db: AsyncSession, company_id: str, tool_id: str) -> bool:
    q = await db.execute(select(Tool.id).where(Tool.id == tool_id, Tool.company_id == company_id))
    return q.scalar_one_or_none() is not None


async def _zone_in_company(db: AsyncSession, company_id: str, zone_id: str) -> bool:
    q = await db.execute(select(Zone.id).where(Zone.id == zone_id, Zone.company_id == company_id))
    return q.scalar_one_or_none() is not None


@router.get("/dashboard", response_model=DashboardOut)
async def pulse_dashboard(db: Db, cid: CompanyId) -> DashboardOut:
    data = await pulse_svc.dashboard_aggregate(db, cid)
    return DashboardOut.model_validate(data)


@router.get("/work-requests", response_model=WorkRequestListOut)
async def list_work_requests(
    db: Db,
    cid: CompanyId,
    status_filter: Optional[str] = Query(None, alias="status"),
    q: Optional[str] = Query(None, description="Search title"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> WorkRequestListOut:
    now = datetime.now(timezone.utc)
    conds: list = [PulseWorkRequest.company_id == cid]
    if status_filter:
        sf = status_filter.strip()
        if sf == "complete":
            sf = "completed"
        if sf == "overdue":
            conds.append(PulseWorkRequest.due_date.isnot(None))
            conds.append(PulseWorkRequest.due_date < now)
            conds.append(PulseWorkRequest.status != PulseWorkRequestStatus.completed)
            conds.append(PulseWorkRequest.status != PulseWorkRequestStatus.cancelled)
        else:
            try:
                st = PulseWorkRequestStatus(sf)
                conds.append(PulseWorkRequest.status == st)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid status")
    if q:
        conds.append(PulseWorkRequest.title.ilike(f"%{q}%"))
    where_clause = and_(*conds)
    total = int(
        (await db.execute(select(func.count()).select_from(PulseWorkRequest).where(where_clause))).scalar_one() or 0
    )
    stmt = (
        select(PulseWorkRequest)
        .where(where_clause)
        .order_by(PulseWorkRequest.updated_at.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return WorkRequestListOut(items=[WorkRequestOut.model_validate(r) for r in rows], total=total)


@router.post("/work-requests", response_model=WorkRequestOut, status_code=status.HTTP_201_CREATED)
async def create_work_request(
    db: Db,
    cid: CompanyId,
    body: WorkRequestCreate,
    user: User = Depends(require_tenant_user),
) -> WorkRequestOut:
    if body.tool_id and not await _tool_in_company(db, cid, body.tool_id):
        raise HTTPException(status_code=400, detail="Unknown asset for this organization")
    resolved_part_id, resolved_equipment_id = await _resolve_pulse_wr_part_equipment(
        db, cid, body.part_id, body.equipment_id
    )
    if resolved_equipment_id and not await pulse_svc.facility_equipment_in_company(db, cid, resolved_equipment_id):
        raise HTTPException(status_code=400, detail="Unknown equipment for this organization")
    if body.zone_id and not await _zone_in_company(db, cid, body.zone_id):
        raise HTTPException(status_code=400, detail="Unknown zone")
    if body.assigned_user_id and not await pulse_svc._user_in_company(db, cid, body.assigned_user_id):
        raise HTTPException(status_code=400, detail="Unknown assignee")

    att = body.attachments if body.attachments is not None else []
    wr = PulseWorkRequest(
        company_id=cid,
        title=body.title,
        description=body.description,
        tool_id=body.tool_id,
        equipment_id=resolved_equipment_id,
        part_id=resolved_part_id,
        zone_id=body.zone_id,
        category=body.category,
        priority=body.priority,
        assigned_user_id=body.assigned_user_id,
        created_by_user_id=user.id,
        due_date=body.due_date,
        attachments=list(att),
    )
    db.add(wr)
    await db.flush()
    if user.role == UserRole.worker:
        await try_mark_onboarding_step(db, user.id, "log_issue")
    else:
        await try_mark_onboarding_step(db, user.id, "create_work_order")
    await db.commit()
    await db.refresh(wr)
    return WorkRequestOut.model_validate(wr)


@router.get("/work-requests/{work_request_id}", response_model=WorkRequestOut)
async def get_work_request(db: Db, cid: CompanyId, work_request_id: str) -> WorkRequestOut:
    wr = await db.get(PulseWorkRequest, work_request_id)
    if not wr or wr.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    return WorkRequestOut.model_validate(wr)


@router.patch("/work-requests/{work_request_id}", response_model=WorkRequestOut)
async def patch_work_request(
    db: Db,
    cid: CompanyId,
    work_request_id: str,
    body: WorkRequestUpdate,
    user: User = Depends(require_tenant_user),
) -> WorkRequestOut:
    wr = await db.get(PulseWorkRequest, work_request_id)
    if not wr or wr.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    old_status = wr.status
    data = body.model_dump(exclude_unset=True)
    if "tool_id" in data and data["tool_id"] and not await _tool_in_company(db, cid, data["tool_id"]):
        raise HTTPException(status_code=400, detail="Unknown asset")
    if "equipment_id" in data and data["equipment_id"]:
        if not await pulse_svc.facility_equipment_in_company(db, cid, data["equipment_id"]):
            raise HTTPException(status_code=400, detail="Unknown equipment")
    if "zone_id" in data and data["zone_id"] and not await _zone_in_company(db, cid, data["zone_id"]):
        raise HTTPException(status_code=400, detail="Unknown zone")
    if "assigned_user_id" in data and data["assigned_user_id"]:
        if not await pulse_svc._user_in_company(db, cid, data["assigned_user_id"]):
            raise HTTPException(status_code=400, detail="Unknown assignee")
    for k, v in data.items():
        setattr(wr, k, v)
    if wr.part_id:
        part = await pulse_svc.equipment_part_for_company(db, cid, wr.part_id)
        if not part:
            raise HTTPException(status_code=400, detail="Unknown part")
        if wr.equipment_id is None:
            wr.equipment_id = part.equipment_id
        elif wr.equipment_id != part.equipment_id:
            raise HTTPException(status_code=400, detail="Part does not belong to equipment")
    if "status" in data:
        if data["status"] == PulseWorkRequestStatus.completed:
            wr.completed_at = datetime.now(timezone.utc)
        else:
            wr.completed_at = None
    if (
        "status" in data
        and data["status"] == PulseWorkRequestStatus.completed
        and old_status != PulseWorkRequestStatus.completed
    ):
        await try_mark_onboarding_step(db, user.id, "complete_work_order")
    await db.commit()
    await db.refresh(wr)
    return WorkRequestOut.model_validate(wr)


@router.delete("/work-requests/{work_request_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_work_request(db: Db, cid: CompanyId, work_request_id: str) -> None:
    wr = await db.get(PulseWorkRequest, work_request_id)
    if not wr or wr.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    await db.execute(delete(PulseWorkRequest).where(PulseWorkRequest.id == wr.id))
    await db.commit()


@router.get("/workers", response_model=list[WorkerOut])
async def list_workers(db: Db, cid: CompanyId) -> list[WorkerOut]:
    uq = await db.execute(
        select(User).where(
            User.company_id == cid,
            User.is_active.is_(True),
            User.role.in_(
                (
                    UserRole.worker,
                    UserRole.manager,
                    UserRole.company_admin,
                )
            ),
        )
    )
    users = uq.scalars().all()
    out: list[WorkerOut] = []
    for u in users:
        pq = await db.execute(
            select(PulseWorkerProfile).where(
                PulseWorkerProfile.user_id == u.id,
                PulseWorkerProfile.company_id == cid,
            )
        )
        prof = pq.scalar_one_or_none()
        certs = list(prof.certifications or []) if prof else []
        notes = prof.notes if prof else None
        avail = dict(prof.availability or {}) if prof else {}
        out.append(
            WorkerOut(
                id=u.id,
                email=u.email,
                full_name=u.full_name,
                role=u.role.value,
                certifications=certs,
                notes=notes,
                availability=avail,
            )
        )
    return out


@router.patch("/workers/{user_id}/profile", response_model=WorkerOut)
async def patch_worker_profile(
    db: Db,
    cid: CompanyId,
    user_id: str,
    body: WorkerProfilePatch,
) -> WorkerOut:
    u = await pulse_svc._user_in_company(db, cid, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    pq = await db.execute(
        select(PulseWorkerProfile).where(
            PulseWorkerProfile.user_id == user_id,
            PulseWorkerProfile.company_id == cid,
        )
    )
    prof = pq.scalar_one_or_none()
    data = body.model_dump(exclude_unset=True)
    if not prof:
        prof = PulseWorkerProfile(company_id=cid, user_id=user_id)
        db.add(prof)
    if "certifications" in data:
        prof.certifications = data["certifications"] or []
    if "notes" in data:
        prof.notes = data["notes"]
    if "availability" in data:
        prof.availability = data["availability"] or {}
    await db.commit()
    pq2 = await db.execute(select(User).where(User.id == user_id))
    u2 = pq2.scalar_one()
    return WorkerOut(
        id=u2.id,
        email=u2.email,
        full_name=u2.full_name,
        role=u2.role.value,
        certifications=list(prof.certifications or []),
        notes=prof.notes,
        availability=dict(prof.availability or {}),
    )


@router.get("/schedule/shifts", response_model=list[ShiftOut])
async def list_shifts(
    db: Db,
    cid: CompanyId,
    from_ts: Optional[datetime] = Query(None, alias="from"),
    to_ts: Optional[datetime] = Query(None, alias="to"),
) -> list[ShiftOut]:
    stmt = select(PulseScheduleShift).where(PulseScheduleShift.company_id == cid)
    if from_ts is not None:
        stmt = stmt.where(PulseScheduleShift.ends_at > from_ts)
    if to_ts is not None:
        stmt = stmt.where(PulseScheduleShift.starts_at < to_ts)
    stmt = stmt.order_by(PulseScheduleShift.starts_at)
    rows = (await db.execute(stmt)).scalars().all()
    shift_ids = [str(r.id) for r in rows if (getattr(r, "shift_kind", None) or "workforce") == "project_task"]
    tasks_by_shift: dict[str, PulseProjectTask] = {}
    if shift_ids:
        tq = await db.execute(
            select(PulseProjectTask).where(PulseProjectTask.calendar_shift_id.in_(shift_ids))
        )
        for t in tq.scalars().all():
            if t.calendar_shift_id:
                tasks_by_shift[str(t.calendar_shift_id)] = t
    proj_ids = {str(t.project_id) for t in tasks_by_shift.values()}
    projects_by_id: dict[str, PulseProject] = {}
    if proj_ids:
        pq = await db.execute(select(PulseProject).where(PulseProject.id.in_(proj_ids)))
        for p in pq.scalars().all():
            projects_by_id[str(p.id)] = p
    out: list[ShiftOut] = []
    for r in rows:
        sid = str(r.id)
        t = tasks_by_shift.get(sid)
        proj = projects_by_id.get(str(t.project_id)) if t else None
        out.append(_shift_to_out(r, t, proj))
    return out


@router.post("/schedule/shifts", response_model=ShiftCreateResult)
async def create_shift(db: Db, cid: CompanyId, body: ShiftCreate) -> ShiftCreateResult:
    if body.zone_id and not await _zone_in_company(db, cid, body.zone_id):
        raise HTTPException(status_code=400, detail="Unknown zone")
    errs, warnings = await pulse_svc.validate_shift_assignment(
        db,
        cid,
        body.starts_at,
        body.ends_at,
        body.assigned_user_id,
        body.requires_supervisor,
        body.requires_ticketed,
        None,
    )
    if errs:
        raise HTTPException(status_code=400, detail={"errors": errs, "warnings": warnings})

    sh = PulseScheduleShift(
        company_id=cid,
        assigned_user_id=body.assigned_user_id,
        zone_id=body.zone_id,
        starts_at=body.starts_at,
        ends_at=body.ends_at,
        shift_type=body.shift_type,
        requires_supervisor=body.requires_supervisor,
        requires_ticketed=body.requires_ticketed,
        shift_kind="workforce",
        display_label=None,
    )
    db.add(sh)
    await db.commit()
    await db.refresh(sh)
    return ShiftCreateResult(shift=_shift_to_out(sh), warnings=warnings)


@router.patch("/schedule/shifts/{shift_id}", response_model=ShiftCreateResult)
async def patch_shift(db: Db, cid: CompanyId, shift_id: str, body: ShiftUpdate) -> ShiftCreateResult:
    sh = await db.get(PulseScheduleShift, shift_id)
    if not sh or sh.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    data = body.model_dump(exclude_unset=True)
    new_user = data.get("assigned_user_id", sh.assigned_user_id)
    new_start = data.get("starts_at", sh.starts_at)
    new_end = data.get("ends_at", sh.ends_at)
    req_sup = data.get("requires_supervisor", sh.requires_supervisor)
    req_tick = data.get("requires_ticketed", sh.requires_ticketed)
    if "zone_id" in data and data["zone_id"] and not await _zone_in_company(db, cid, data["zone_id"]):
        raise HTTPException(status_code=400, detail="Unknown zone")

    errs, warnings = await pulse_svc.validate_shift_assignment(
        db,
        cid,
        new_start,
        new_end,
        str(new_user),
        bool(req_sup),
        bool(req_tick),
        exclude_shift_id=shift_id,
    )
    if errs:
        raise HTTPException(status_code=400, detail={"errors": errs, "warnings": warnings})

    for k, v in data.items():
        setattr(sh, k, v)
    await db.flush()
    await proj_task_svc.sync_task_from_linked_shift(db, sh)
    await db.commit()
    await db.refresh(sh)
    tq = await db.execute(select(PulseProjectTask).where(PulseProjectTask.calendar_shift_id == sh.id))
    task = tq.scalar_one_or_none()
    proj = await db.get(PulseProject, task.project_id) if task else None
    return ShiftCreateResult(shift=_shift_to_out(sh, task, proj), warnings=warnings)


@router.delete("/schedule/shifts/{shift_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_shift(db: Db, cid: CompanyId, shift_id: str) -> None:
    sh = await db.get(PulseScheduleShift, shift_id)
    if not sh or sh.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    await db.execute(delete(PulseScheduleShift).where(PulseScheduleShift.id == sh.id))
    await db.commit()


@router.get("/zones", response_model=list[ZoneOut])
async def list_zones(db: Db, cid: CompanyId) -> list[ZoneOut]:
    zq = await db.execute(select(Zone).where(Zone.company_id == cid).order_by(Zone.name))
    zones = zq.scalars().all()
    return [ZoneOut(id=z.id, name=z.name, meta=dict(z.meta or {})) for z in zones]


@router.get("/assets", response_model=list[AssetOut])
async def list_assets(db: Db, cid: CompanyId) -> list[AssetOut]:
    tq = await db.execute(select(Tool).where(Tool.company_id == cid).order_by(Tool.name))
    tools = tq.scalars().all()
    return [
        AssetOut(
            id=t.id,
            tag_id=t.tag_id,
            name=t.name,
            zone_id=t.zone_id,
            status=t.status.value if hasattr(t.status, "value") else str(t.status),
            assigned_user_id=t.assigned_user_id,
        )
        for t in tools
    ]


@router.patch("/assets/{tool_id}", response_model=AssetOut)
async def patch_asset(db: Db, cid: CompanyId, tool_id: str, body: AssetPatch) -> AssetOut:
    t = await db.get(Tool, tool_id)
    if not t or t.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    if body.status is not None:
        try:
            t.status = ToolStatus(body.status)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid status")
    await db.commit()
    await db.refresh(t)
    return AssetOut(
        id=t.id,
        tag_id=t.tag_id,
        name=t.name,
        zone_id=t.zone_id,
        status=t.status.value,
        assigned_user_id=t.assigned_user_id,
    )


@router.get("/inventory", response_model=list[InventoryItemOut])
async def list_inventory(
    db: Db,
    cid: CompanyId,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> list[InventoryItemOut]:
    iq = await db.execute(
        select(InventoryItem)
        .where(InventoryItem.company_id == cid)
        .order_by(InventoryItem.name)
        .offset(offset)
        .limit(limit)
    )
    rows = iq.scalars().all()
    return [InventoryItemOut.model_validate(r) for r in rows]


@router.get("/inventory/low-stock", response_model=list[InventoryItemOut])
async def low_stock(db: Db, cid: CompanyId) -> list[InventoryItemOut]:
    iq = await db.execute(
        select(InventoryItem)
        .where(
            InventoryItem.company_id == cid,
            InventoryItem.quantity <= InventoryItem.low_stock_threshold,
        )
        .order_by(InventoryItem.name)
    )
    rows = iq.scalars().all()
    return [InventoryItemOut.model_validate(r) for r in rows]


@router.patch("/inventory/{item_id}", response_model=InventoryItemOut)
async def patch_inventory(db: Db, cid: CompanyId, item_id: str, body: InventoryPatch) -> InventoryItemOut:
    item = await db.get(InventoryItem, item_id)
    if not item or item.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    data = body.model_dump(exclude_unset=True)
    if "quantity" in data:
        item.quantity = float(data["quantity"])
    if "low_stock_threshold" in data:
        item.low_stock_threshold = float(data["low_stock_threshold"])
    if "item_type" in data and data["item_type"] is not None:
        item.item_type = str(data["item_type"])
    if "category" in data:
        item.category = data["category"]
    if "inv_status" in data and data["inv_status"] is not None:
        item.inv_status = str(data["inv_status"])
    if "zone_id" in data:
        item.zone_id = data["zone_id"]
    if "assigned_user_id" in data:
        item.assigned_user_id = data["assigned_user_id"]
    if "linked_tool_id" in data:
        item.linked_tool_id = data["linked_tool_id"]
    if "item_condition" in data and data["item_condition"] is not None:
        item.item_condition = str(data["item_condition"])
    if "reorder_flag" in data and data["reorder_flag"] is not None:
        item.reorder_flag = bool(data["reorder_flag"])
    if "unit_cost" in data:
        item.unit_cost = data["unit_cost"]
    await db.commit()
    await db.refresh(item)
    return InventoryItemOut.model_validate(item)


@router.get("/equipment", response_model=list[BeaconEquipmentOut])
async def list_equipment(db: Db, cid: CompanyId) -> list[BeaconEquipmentOut]:
    eq = await db.execute(
        select(PulseBeaconEquipment).where(PulseBeaconEquipment.company_id == cid).order_by(PulseBeaconEquipment.beacon_id)
    )
    rows = eq.scalars().all()
    return [BeaconEquipmentOut.model_validate(r) for r in rows]


@router.post("/equipment", response_model=BeaconEquipmentOut, status_code=status.HTTP_201_CREATED)
async def create_equipment(db: Db, cid: CompanyId, body: BeaconEquipmentCreate) -> BeaconEquipmentOut:
    if body.tool_id and not await _tool_in_company(db, cid, body.tool_id):
        raise HTTPException(status_code=400, detail="Unknown asset")
    row = PulseBeaconEquipment(
        company_id=cid,
        beacon_id=body.beacon_id.strip(),
        tool_id=body.tool_id,
        location_label=body.location_label or "",
    )
    db.add(row)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Beacon id may already exist for this organization")
    await db.refresh(row)
    return BeaconEquipmentOut.model_validate(row)


@router.patch("/equipment/{equipment_id}", response_model=BeaconEquipmentOut)
async def patch_equipment(
    db: Db,
    cid: CompanyId,
    equipment_id: str,
    body: BeaconEquipmentPatch,
) -> BeaconEquipmentOut:
    row = await db.get(PulseBeaconEquipment, equipment_id)
    if not row or row.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    data = body.model_dump(exclude_unset=True)
    if "tool_id" in data and data["tool_id"] and not await _tool_in_company(db, cid, data["tool_id"]):
        raise HTTPException(status_code=400, detail="Unknown asset")
    for k, v in data.items():
        setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return BeaconEquipmentOut.model_validate(row)


@router.post("/equipment/{equipment_id}/photo", response_model=PhotoUploadOut)
async def upload_equipment_photo(
    db: Db,
    cid: CompanyId,
    equipment_id: str,
    file: UploadFile = File(...),
) -> PhotoUploadOut:
    row = await db.get(PulseBeaconEquipment, equipment_id)
    if not row or row.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    content = await file.read()
    if len(content) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 8MB)")
    path = await pulse_svc.save_beacon_photo(cid, equipment_id, file.filename or "photo", content)
    row.photo_path = path
    await db.commit()
    return PhotoUploadOut(photo_path=path)
