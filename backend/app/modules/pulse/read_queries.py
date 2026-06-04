"""Shared Pulse read paths for HTTP routes and dashboard bootstrap (batched where possible)."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import and_, func, select
from sqlalchemy.dialects.postgresql import array as pg_array
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.inventory.policy import EffectiveInventoryPolicy, resolve_effective_inventory_policy
from app.core.schedule_department import (
    apply_shift_department_filter,
    load_hr_by_user_ids,
    normalize_schedule_department_slug,
    primary_department_slug_from_hr,
    schedule_allowed_department_slugs,
)
from app.core.user_avatar_upload import co_worker_avatar_url
from app.core.user_roles import primary_jwt_role
from app.models.domain import (
    InventoryItem,
    OperationalRole,
    Tool,
    User,
    UserAccountStatus,
    UserRole,
    Zone,
)
from app.models.pulse_models import (
    PulseBeaconEquipment,
    PulseProject,
    PulseProjectTask,
    PulseScheduleShift,
    PulseWorkerHR,
    PulseWorkerProfile,
    PulseWorkerSkill,
    PulseWorkRequest,
    PulseWorkRequestStatus,
)
from app.modules.pulse import service as pulse_svc
from app.services.schedule_facility_zones import ensure_schedule_facility_zones
from app.repositories import inventory_scope_repository as inv_scope_repo
from app.schemas.pulse import (
    AssetOut,
    BeaconEquipmentOut,
    DashboardOut,
    InventoryItemOut,
    ShiftOut,
    WorkRequestListOut,
    WorkRequestOut,
    WorkerOut,
    WorkerSkillMiniOut,
    ZoneOut,
)

def _worker_scheduling_fields(prof: PulseWorkerProfile | None) -> tuple[Optional[str], list[dict[str, Any]]]:
    if not prof:
        return None, []
    raw = dict(prof.scheduling or {})
    et = raw.get("employment_type")
    rs = raw.get("recurring_shifts") or []
    if not isinstance(rs, list):
        rs = []
    if et is None or (isinstance(et, str) and not str(et).strip()):
        emp: Optional[str] = None
    else:
        emp = str(et).strip()
    rec = [x for x in rs if isinstance(x, dict)]
    return emp, rec


async def fetch_dashboard(
    db: AsyncSession,
    cid: str,
    user: User,
) -> DashboardOut:
    inv_filter: set[str] | None = None
    policy = await resolve_effective_inventory_policy(db, user, cid)
    if not policy.is_company_admin:
        inv_filter = set(policy.readable_scope_ids)
    data = await pulse_svc.dashboard_aggregate(db, cid, inventory_readable_scope_ids=inv_filter)
    return DashboardOut.model_validate(data)


async def fetch_work_requests_page(
    db: AsyncSession,
    cid: str,
    *,
    limit: int = 40,
    offset: int = 0,
) -> WorkRequestListOut:
    conds: list = [PulseWorkRequest.company_id == cid]
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


async def fetch_workers_roster(
    db: AsyncSession,
    cid: str,
    *,
    department_slug: Optional[str] = None,
) -> list[WorkerOut]:
    uq = await db.execute(
        select(User).where(
            User.company_id == cid,
            User.is_active.is_(True),
            User.account_status == UserAccountStatus.active,
            User.operational_role.in_([e.value for e in OperationalRole]),
            User.roles.overlap(
                pg_array(
                    [
                        UserRole.worker.value,
                        UserRole.lead.value,
                        UserRole.supervisor.value,
                        UserRole.manager.value,
                        UserRole.company_admin.value,
                    ]
                )
            ),
        )
    )
    users = list(uq.scalars().all())
    uids = [str(u.id) for u in users]
    hr_map = await load_hr_by_user_ids(db, cid, uids)
    allowed = await schedule_allowed_department_slugs(db, cid)
    dept_filter = (
        await normalize_schedule_department_slug(db, cid, department_slug) if department_slug else None
    )

    prof_map: dict[str, PulseWorkerProfile] = {}
    if uids:
        pq = await db.execute(
            select(PulseWorkerProfile).where(
                PulseWorkerProfile.company_id == cid,
                PulseWorkerProfile.user_id.in_(uids),
            )
        )
        for pr in pq.scalars().all():
            prof_map[str(pr.user_id)] = pr

    skills_map: dict[str, list[WorkerSkillMiniOut]] = defaultdict(list)
    if uids:
        sq = await db.execute(
            select(PulseWorkerSkill.user_id, PulseWorkerSkill.name, PulseWorkerSkill.level).where(
                PulseWorkerSkill.company_id == cid,
                PulseWorkerSkill.user_id.in_(uids),
            )
        )
        for row in sq.all():
            uid, name, level = row[0], row[1], row[2]
            skills_map[str(uid)].append(WorkerSkillMiniOut(name=name, level=int(level or 1)))

    out: list[WorkerOut] = []
    for u in users:
        prof = prof_map.get(str(u.id))
        certs = list(prof.certifications or []) if prof else []
        notes = prof.notes if prof else None
        avail = dict(prof.availability or {}) if prof else {}
        emp, rec = _worker_scheduling_fields(prof)
        uid_s = str(u.id)
        worker_dept = primary_department_slug_from_hr(hr_map.get(uid_s), allowed=allowed)
        if dept_filter and worker_dept != dept_filter:
            continue
        out.append(
            WorkerOut(
                id=uid_s,
                email=u.email,
                full_name=u.full_name,
                role=primary_jwt_role(u).value,
                roles=list(u.roles),
                certifications=certs,
                skills=skills_map.get(uid_s, []),
                notes=notes,
                availability=avail,
                avatar_url=co_worker_avatar_url(uid_s, u.avatar_url),
                employment_type=emp,
                recurring_shifts=rec,
                department_slug=worker_dept,
            )
        )
    return out


async def fetch_assets(db: AsyncSession, cid: str) -> list[AssetOut]:
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


async def fetch_low_stock_inventory(
    db: AsyncSession,
    cid: str,
    user: User,
) -> list[InventoryItemOut]:
    policy = await resolve_effective_inventory_policy(db, user, cid)
    stmt = select(InventoryItem).where(
        InventoryItem.company_id == cid,
        InventoryItem.quantity <= InventoryItem.low_stock_threshold,
    )
    stmt = inv_scope_repo.apply_inventory_scope_filter(stmt, InventoryItem.scope_id, policy)
    iq = await db.execute(stmt.order_by(InventoryItem.name))
    rows = iq.scalars().all()
    return [InventoryItemOut.model_validate(r) for r in rows]


async def fetch_schedule_facilities(db: AsyncSession, cid: str) -> list[ZoneOut]:
    rows = await ensure_schedule_facility_zones(db, cid)
    await db.commit()
    return [ZoneOut(id=z.id, name=z.name, meta=dict(z.meta or {})) for z in rows]


async def fetch_beacon_equipment(db: AsyncSession, cid: str) -> list[BeaconEquipmentOut]:
    eq = await db.execute(
        select(PulseBeaconEquipment)
        .where(PulseBeaconEquipment.company_id == cid)
        .order_by(PulseBeaconEquipment.beacon_id)
    )
    rows = eq.scalars().all()
    return [BeaconEquipmentOut.model_validate(r) for r in rows]


async def fetch_schedule_shifts(
    db: AsyncSession,
    cid: str,
    *,
    from_ts: Optional[datetime] = None,
    to_ts: Optional[datetime] = None,
    department_slug: Optional[str] = None,
) -> list[ShiftOut]:
    from app.modules.pulse.router import _shift_to_out

    stmt = select(PulseScheduleShift).where(PulseScheduleShift.company_id == cid)
    if from_ts is not None:
        stmt = stmt.where(PulseScheduleShift.ends_at > from_ts)
    if to_ts is not None:
        stmt = stmt.where(PulseScheduleShift.starts_at < to_ts)
    stmt = apply_shift_department_filter(stmt, department_slug)
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
