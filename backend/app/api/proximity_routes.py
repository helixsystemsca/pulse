"""Proximity events → ranked ready tasks for a worker near equipment."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_tenant_user
from app.core.database import get_db
from app.models.domain import User
from app.models.pulse_models import PulseBeaconEquipment, PulseProjectTask, PulseTaskStatus
from app.modules.pulse.accountability_service import log_proximity_offer
from app.modules.pulse.ready_proximity import proximity_sort_key, task_priority_str
from app.modules.pulse.task_dependencies import compute_blocking_for_tasks, fetch_prerequisite_ids_for_tasks
from app.schemas.projects import ProximityEventIn, ProximityTaskOut, ProximityTasksResponse

router = APIRouter(tags=["proximity"])


async def _company_id(user: User = Depends(require_tenant_user)) -> str:
    assert user.company_id is not None
    return str(user.company_id)


CompanyId = Annotated[str, Depends(_company_id)]
Db = Annotated[AsyncSession, Depends(get_db)]


@router.post("/proximity/events", response_model=ProximityTasksResponse)
async def proximity_event(
    db: Db,
    cid: CompanyId,
    user: Annotated[User, Depends(require_tenant_user)],
    body: ProximityEventIn,
) -> ProximityTasksResponse:
    uid = body.user_id.strip()
    if uid != str(user.id):
        raise HTTPException(status_code=403, detail="user_id must match authenticated user")
    tag = body.location_tag_id.strip()

    q = await db.execute(
        select(PulseProjectTask).where(
            PulseProjectTask.company_id == cid,
            PulseProjectTask.location_tag_id == tag,
            PulseProjectTask.status == PulseTaskStatus.todo,
            or_(
                PulseProjectTask.assigned_user_id == uid,
                PulseProjectTask.assigned_user_id.is_(None),
            ),
        )
    )
    candidates = list(q.scalars().all())
    eq_label = await db.scalar(
        select(PulseBeaconEquipment.location_label).where(
            PulseBeaconEquipment.company_id == cid,
            PulseBeaconEquipment.beacon_id == tag,
        ).limit(1)
    )
    equip_name = (eq_label or "").strip() or tag

    if not candidates:
        return ProximityTasksResponse(tasks=[], equipment_label=equip_name)

    ids = [str(c.id) for c in candidates]
    prereq_map = await fetch_prerequisite_ids_for_tasks(db, ids)
    needed: set[str] = set(ids)
    for i in ids:
        needed.update(prereq_map.get(i, []))
    tq = await db.execute(select(PulseProjectTask).where(PulseProjectTask.id.in_(needed)))
    by_id = {str(t.id): t for t in tq.scalars().all()}
    block_map = compute_blocking_for_tasks(by_id, prereq_map)
    ready = [c for c in candidates if not block_map[str(c.id)][0]]
    ready_sorted = sorted(ready, key=proximity_sort_key)[:3]

    tasks_out: list[ProximityTaskOut] = []
    for t in ready_sorted:
        sop = getattr(t, "sop_id", None)
        tasks_out.append(
            ProximityTaskOut(
                id=str(t.id),
                title=t.title,
                priority=task_priority_str(t),
                assigned_to=str(t.assigned_user_id) if t.assigned_user_id else None,
                due_date=t.due_date,
                project_id=str(t.project_id),
                sop_id=str(sop).strip() if sop else None,
            )
        )
    event_log_id = await log_proximity_offer(
        db, cid, uid, tag, [str(x.id) for x in ready_sorted]
    )
    return ProximityTasksResponse(
        tasks=tasks_out, equipment_label=equip_name, event_log_id=event_log_id
    )
