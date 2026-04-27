"""PM tasks on equipment + internal due-scan (cron)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_company_user, get_db, require_manager_or_above
from app.core.config import get_settings
from app.models.domain import Tool, User
from app.models.pm_models import PmTask, PmTaskChecklistItem, PmTaskPart
from app.schemas.pm_task import PmDueScanResultOut, PmTaskCreateIn, PmTaskOut
from app.services import pm_task_service as pm_svc

router = APIRouter(prefix="/equipment", tags=["pm-tasks"])
tools_router = APIRouter(prefix="/tools", tags=["pm-tasks"])

Db = Annotated[AsyncSession, Depends(get_db)]
TenantUser = Annotated[User, Depends(get_current_company_user)]
MutatorUser = Annotated[User, Depends(require_manager_or_above)]


async def _equipment_company_or_404(db: AsyncSession, company_id: str, equipment_id: str) -> None:
    from app.models.domain import FacilityEquipment

    row = await db.get(FacilityEquipment, equipment_id)
    if not row or str(row.company_id) != str(company_id):
        raise HTTPException(status_code=404, detail="Equipment not found")


async def _tool_company_or_404(db: AsyncSession, company_id: str, tool_id: str) -> None:
    row = await db.get(Tool, tool_id)
    if not row or str(row.company_id) != str(company_id):
        raise HTTPException(status_code=404, detail="Tool not found")


def _task_to_out(task: PmTask, parts_count: int) -> PmTaskOut:
    asset_id = task.equipment_id or task.tool_id or ""
    return PmTaskOut(
        id=task.id,
        asset_id=asset_id,
        equipment_id=task.equipment_id,
        tool_id=task.tool_id,
        name=task.name,
        description=task.description,
        frequency_type=task.frequency_type,
        frequency_value=task.frequency_value,
        last_completed_at=task.last_completed_at,
        next_due_at=task.next_due_at,
        estimated_duration_minutes=task.estimated_duration_minutes,
        auto_create_work_order=task.auto_create_work_order,
        parts_count=parts_count,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


@router.get("/{equipment_id}/pm-tasks", response_model=list[PmTaskOut])
async def list_pm_tasks(
    db: Db,
    user: TenantUser,
    equipment_id: str,
) -> list[PmTaskOut]:
    cid = str(user.company_id) if user.company_id else ""
    if not cid:
        raise HTTPException(status_code=403, detail="Company context required")
    await _equipment_company_or_404(db, cid, equipment_id)
    counts = (
        (
            await db.execute(
                select(PmTaskPart.pm_task_id, func.count())
                .join(PmTask, PmTask.id == PmTaskPart.pm_task_id)
                .where(PmTask.equipment_id == equipment_id)
                .where(PmTask.company_id == cid)
                .group_by(PmTaskPart.pm_task_id)
            )
        )
        .all()
    )
    count_map = {str(r[0]): int(r[1]) for r in counts}
    tasks = (
        (
            await db.execute(
                select(PmTask)
                .where(PmTask.company_id == cid, PmTask.equipment_id == equipment_id)
                .order_by(PmTask.name)
            )
        )
        .scalars()
        .all()
    )
    return [_task_to_out(t, count_map.get(t.id, 0)) for t in tasks]


@tools_router.get("/{tool_id}/pm-tasks", response_model=list[PmTaskOut])
async def list_tool_pm_tasks(
    db: Db,
    user: TenantUser,
    tool_id: str,
) -> list[PmTaskOut]:
    cid = str(user.company_id) if user.company_id else ""
    if not cid:
        raise HTTPException(status_code=403, detail="Company context required")
    await _tool_company_or_404(db, cid, tool_id)
    counts = (
        (
            await db.execute(
                select(PmTaskPart.pm_task_id, func.count())
                .join(PmTask, PmTask.id == PmTaskPart.pm_task_id)
                .where(PmTask.tool_id == tool_id)
                .where(PmTask.company_id == cid)
                .group_by(PmTaskPart.pm_task_id)
            )
        )
        .all()
    )
    count_map = {str(r[0]): int(r[1]) for r in counts}
    tasks = (
        (await db.execute(select(PmTask).where(PmTask.company_id == cid, PmTask.tool_id == tool_id).order_by(PmTask.name)))
        .scalars()
        .all()
    )
    return [_task_to_out(t, count_map.get(t.id, 0)) for t in tasks]


@router.post("/{equipment_id}/pm-tasks", response_model=PmTaskOut, status_code=status.HTTP_201_CREATED)
async def create_pm_task(
    db: Db,
    user: MutatorUser,
    equipment_id: str,
    body: PmTaskCreateIn,
) -> PmTaskOut:
    cid = str(user.company_id) if user.company_id else ""
    if not cid:
        raise HTTPException(status_code=403, detail="Company context required")
    await _equipment_company_or_404(db, cid, equipment_id)
    try:
        ft, fv = pm_svc.validate_pm_frequency(body.frequency_type, body.frequency_value)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    merged_parts: dict[str, int] = {}
    for line in body.parts:
        merged_parts[line.part_id] = merged_parts.get(line.part_id, 0) + line.quantity
    try:
        await pm_svc.assert_parts_belong_to_equipment(db, equipment_id=equipment_id, part_ids=merged_parts.keys())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    now = datetime.now(timezone.utc)
    baseline = now
    next_due = pm_svc.compute_next_due_at(baseline=baseline, frequency_type=ft, frequency_value=fv)
    task = PmTask(
        company_id=cid,
        equipment_id=equipment_id,
        name=body.name.strip(),
        description=(body.description or "").strip() or None,
        frequency_type=ft,
        frequency_value=fv,
        last_completed_at=None,
        next_due_at=next_due,
        estimated_duration_minutes=body.estimated_duration_minutes,
        auto_create_work_order=bool(body.auto_create_work_order),
    )
    db.add(task)
    await db.flush()
    for part_id, qty in merged_parts.items():
        db.add(
            PmTaskPart(
                pm_task_id=task.id,
                part_id=part_id,
                quantity=qty,
            )
        )
    for item in body.checklist:
        db.add(
            PmTaskChecklistItem(
                pm_task_id=task.id,
                label=item.label.strip(),
                sort_order=item.sort_order,
            )
        )
    await db.commit()
    await db.refresh(task)
    return _task_to_out(task, len(merged_parts))


@tools_router.post("/{tool_id}/pm-tasks", response_model=PmTaskOut, status_code=status.HTTP_201_CREATED)
async def create_tool_pm_task(
    db: Db,
    user: MutatorUser,
    tool_id: str,
    body: PmTaskCreateIn,
) -> PmTaskOut:
    cid = str(user.company_id) if user.company_id else ""
    if not cid:
        raise HTTPException(status_code=403, detail="Company context required")
    await _tool_company_or_404(db, cid, tool_id)
    try:
        ft, fv = pm_svc.validate_pm_frequency(body.frequency_type, body.frequency_value)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    now = datetime.now(timezone.utc)
    next_due = pm_svc.compute_next_due_at(baseline=now, frequency_type=ft, frequency_value=fv)
    task = PmTask(
        company_id=cid,
        tool_id=tool_id,
        equipment_id=None,
        name=body.name.strip(),
        description=(body.description or "").strip() or None,
        frequency_type=ft,
        frequency_value=fv,
        last_completed_at=None,
        next_due_at=next_due,
        estimated_duration_minutes=body.estimated_duration_minutes,
        auto_create_work_order=bool(body.auto_create_work_order),
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return _task_to_out(task, 0)


@router.delete("/{equipment_id}/pm-tasks/{pm_task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pm_task(
    db: Db,
    user: MutatorUser,
    equipment_id: str,
    pm_task_id: str,
) -> None:
    cid = str(user.company_id) if user.company_id else ""
    if not cid:
        raise HTTPException(status_code=403, detail="Company context required")
    await _equipment_company_or_404(db, cid, equipment_id)
    task = (
        (await db.execute(select(PmTask).where(PmTask.company_id == cid, PmTask.id == pm_task_id)))
        .scalars()
        .one_or_none()
    )
    if not task or task.equipment_id != equipment_id:
        raise HTTPException(status_code=404, detail="PM task not found")
    await db.execute(delete(PmTask).where(PmTask.company_id == cid, PmTask.id == pm_task_id))
    await db.commit()


internal_router = APIRouter(prefix="/internal", tags=["internal-pm"])


@internal_router.post("/pm-tasks/run-due-scan", response_model=PmDueScanResultOut)
async def internal_run_pm_due_scan(
    db: Db,
    x_pm_cron_key: Annotated[Optional[str], Header(alias="X-PM-Cron-Key")] = None,
) -> PmDueScanResultOut:
    settings = get_settings()
    secret = (settings.pm_cron_secret or "").strip()
    if not secret:
        raise HTTPException(status_code=503, detail="PM_CRON_SECRET is not configured")
    if (x_pm_cron_key or "").strip() != secret:
        raise HTTPException(status_code=401, detail="Invalid cron key")
    out = await pm_svc.run_pm_due_scan(db)
    return PmDueScanResultOut(work_orders_created=out["work_orders_created"])


@internal_router.post("/maintenance-inferences/cleanup")
async def internal_cleanup_maintenance_inferences(
    db: Db,
    x_pm_cron_key: Annotated[Optional[str], Header(alias="X-PM-Cron-Key")] = None,
) -> dict:
    """
    Nightly TTL cleanup for maintenance inference rows.

    Deletes dismissed / auto_logged / expired rows older than 90 days.
    Protected by the same cron secret as PM due-scan.
    """
    settings = get_settings()
    secret = (settings.pm_cron_secret or "").strip()
    if not secret:
        raise HTTPException(status_code=503, detail="PM_CRON_SECRET is not configured")
    if (x_pm_cron_key or "").strip() != secret:
        raise HTTPException(status_code=401, detail="Invalid cron key")

    stmt = text(
        """
        DELETE FROM maintenance_inferences
        WHERE created_at < (now() AT TIME ZONE 'utc') - interval '90 days'
          AND status IN ('dismissed', 'auto_logged', 'expired');
        """
    )
    res = await db.execute(stmt)
    await db.commit()
    deleted = int(res.rowcount or 0)
    return {"deleted": deleted}
