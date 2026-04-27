"""Aggregate payload for worker task detail (work order context + related rows)."""

from __future__ import annotations

from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import EquipmentPart, FacilityEquipment
from app.models.gamification_models import Task
from app.models.pm_models import PmTask, PmTaskChecklistItem, PmTaskPart, PulseWorkRequestPartLine
from app.models.pulse_models import (
    PulseProcedure,
    PulseProjectTask,
    PulseWorkRequest,
)


def _wo_status(wr: PulseWorkRequest) -> str:
    st = getattr(wr.status, "value", wr.status)
    return str(st)


def _wo_priority(wr: PulseWorkRequest) -> str:
    pr = getattr(wr.priority, "value", wr.priority)
    return str(pr)


def _wo_type(wr: PulseWorkRequest) -> str:
    wt = getattr(wr.work_order_type, "value", wr.work_order_type)
    return str(wt)


async def build_task_full_payload(db: AsyncSession, *, task: Task, company_id: str) -> dict[str, Any]:
    """Return a dict matching TaskFullOut (kept as dict to avoid circular imports)."""
    from app.schemas.gamification import (  # local import
        EquipmentHistoryItemOut,
        PartLineOut,
        ProcedureOut,
        TaskOut,
        WorkOrderBriefOut,
    )

    task_out = TaskOut.model_validate(task)
    out: dict[str, Any] = {
        "task": task_out.model_dump(),
        "work_order": None,
        "procedures": [],
        "parts": [],
        "attachments": [],
        "equipment_history": [],
    }

    st = str(task.source_type or "")
    sid = str(task.source_id) if task.source_id else None
    if not sid:
        return out

    if st == "work_order":
        wr = await db.get(PulseWorkRequest, sid)
        if not wr or str(wr.company_id) != company_id:
            return out

        wo = WorkOrderBriefOut(
            id=str(wr.id),
            title=str(wr.title or ""),
            description=wr.description,
            status=_wo_status(wr),
            priority=_wo_priority(wr),
            work_order_type=_wo_type(wr),
            equipment_id=str(wr.equipment_id) if wr.equipment_id else None,
            part_id=str(wr.part_id) if wr.part_id else None,
            procedure_id=str(wr.procedure_id) if wr.procedure_id else None,
            due_date=wr.due_date,
            assigned_user_id=str(wr.assigned_user_id) if wr.assigned_user_id else None,
            attachments=list(wr.attachments or []),
            created_at=wr.created_at,
            updated_at=wr.updated_at,
        )
        out["work_order"] = wo.model_dump()
        out["attachments"] = list(wr.attachments or [])

        procedures: list[ProcedureOut] = []
        if wr.procedure_id:
            proc = await db.get(PulseProcedure, wr.procedure_id)
            if proc and str(proc.company_id) == company_id:
                procedures.append(
                    ProcedureOut(id=str(proc.id), title=str(proc.title or ""), steps=list(proc.steps or []))
                )
        out["procedures"] = [p.model_dump() for p in procedures]

        parts: list[PartLineOut] = []
        part_rows = (
            await db.execute(
                select(PulseWorkRequestPartLine, EquipmentPart)
                .join(EquipmentPart, EquipmentPart.id == PulseWorkRequestPartLine.part_id)
                .where(PulseWorkRequestPartLine.work_request_id == wr.id)
            )
        ).all()
        seen: set[str] = set()
        for line, ep in part_rows:
            parts.append(
                PartLineOut(
                    part_id=str(ep.id),
                    quantity=int(line.quantity),
                    name=str(ep.name or ""),
                    description=ep.description,
                    equipment_id=str(ep.equipment_id) if ep.equipment_id else None,
                )
            )
            seen.add(str(ep.id))
        if wr.part_id and str(wr.part_id) not in seen:
            ep = await db.get(EquipmentPart, wr.part_id)
            if ep and str(ep.company_id) == company_id:
                parts.append(
                    PartLineOut(
                        part_id=str(ep.id),
                        quantity=1,
                        name=str(ep.name or ""),
                        description=ep.description,
                        equipment_id=str(ep.equipment_id) if ep.equipment_id else None,
                    )
                )
        out["parts"] = [p.model_dump() for p in parts]

        if wr.equipment_id:
            hist = (
                await db.execute(
                    select(PulseWorkRequest)
                    .where(
                        PulseWorkRequest.company_id == company_id,
                        PulseWorkRequest.equipment_id == wr.equipment_id,
                        PulseWorkRequest.id != wr.id,
                    )
                    .order_by(PulseWorkRequest.updated_at.desc())
                    .limit(10)
                )
            ).scalars().all()
            out["equipment_history"] = [
                EquipmentHistoryItemOut(
                    id=str(h.id),
                    title=str(h.title or ""),
                    status=_wo_status(h),
                    updated_at=h.updated_at,
                    work_order_type=_wo_type(h),
                ).model_dump()
                for h in hist
            ]
        return out

    if st == "pm":
        pm = (
            (await db.execute(select(PmTask).where(PmTask.id == sid, PmTask.company_id == company_id)))
            .scalars()
            .one_or_none()
        )
        if not pm:
            return out
        eq_id = str(pm.equipment_id) if pm.equipment_id else None
        checklist = (
            await db.execute(
                select(PmTaskChecklistItem)
                .where(PmTaskChecklistItem.pm_task_id == pm.id)
                .order_by(PmTaskChecklistItem.sort_order.asc(), PmTaskChecklistItem.id.asc())
            )
        ).scalars().all()
        steps: list[dict[str, Any]] = [{"label": str(c.label)} for c in checklist]
        out["procedures"] = [
            ProcedureOut(id=str(pm.id), title=f"PM: {pm.name}", steps=steps).model_dump(),
        ]
        parts: list[PartLineOut] = []
        for line, ep in (
            await db.execute(
                select(PmTaskPart, EquipmentPart)
                .join(EquipmentPart, EquipmentPart.id == PmTaskPart.part_id)
                .where(PmTaskPart.pm_task_id == pm.id)
            )
        ).all():
            parts.append(
                PartLineOut(
                    part_id=str(ep.id),
                    quantity=int(line.quantity),
                    name=str(ep.name or ""),
                    description=ep.description,
                    equipment_id=str(ep.equipment_id) if ep.equipment_id else None,
                )
            )
        out["parts"] = [p.model_dump() for p in parts]
        if eq_id:
            hist = (
                await db.execute(
                    select(PulseWorkRequest)
                    .where(
                        PulseWorkRequest.company_id == company_id,
                        PulseWorkRequest.equipment_id == eq_id,
                    )
                    .order_by(PulseWorkRequest.updated_at.desc())
                    .limit(10)
                )
            ).scalars().all()
            out["equipment_history"] = [
                EquipmentHistoryItemOut(
                    id=str(h.id),
                    title=str(h.title or ""),
                    status=_wo_status(h),
                    updated_at=h.updated_at,
                    work_order_type=_wo_type(h),
                ).model_dump()
                for h in hist
            ]
        return out

    if st == "project":
        pt = await db.get(PulseProjectTask, sid)
        if not pt or str(pt.company_id) != company_id:
            return out
        out["procedures"] = [
            ProcedureOut(
                id=str(pt.id),
                title=str(pt.title or "Project task"),
                steps=[],
            ).model_dump()
        ]
        return out

    # routine / self / unknown — task-only context
    if task.equipment_id:
        eq = await db.get(FacilityEquipment, task.equipment_id)
        if eq and str(eq.company_id) == company_id:
            hist = (
                await db.execute(
                    select(PulseWorkRequest)
                    .where(
                        PulseWorkRequest.company_id == company_id,
                        PulseWorkRequest.equipment_id == task.equipment_id,
                    )
                    .order_by(PulseWorkRequest.updated_at.desc())
                    .limit(10)
                )
            ).scalars().all()
            out["equipment_history"] = [
                EquipmentHistoryItemOut(
                    id=str(h.id),
                    title=str(h.title or ""),
                    status=_wo_status(h),
                    updated_at=h.updated_at,
                    work_order_type=_wo_type(h),
                ).model_dump()
                for h in hist
            ]
    return out
