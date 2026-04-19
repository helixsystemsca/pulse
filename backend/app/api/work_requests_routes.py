"""
Issue tracking / work requests under `/api/work-requests`.

Uses `pulse_work_requests` (+ comments, activity, settings). Multi-tenant with optional `company_id` for system admins.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Any, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_manager_or_above
from app.core.user_roles import is_field_worker_like, user_has_any_role
from app.services.onboarding_service import try_mark_onboarding_step
from app.services.pm_task_service import sync_pm_task_after_work_order_completed
from app.models.domain import EquipmentPart, FacilityEquipment, Tool, User, UserRole, Zone
from app.core.org_module_settings_merge import merge_org_module_settings
from app.models.pulse_models import (
    PulseOrgModuleSettings,
    PulseWorkOrderType,
    PulseWorkRequest,
    PulseWorkRequestActivity,
    PulseWorkRequestComment,
    PulseWorkRequestPriority,
    PulseWorkRequestSettings,
    PulseWorkRequestStatus,
)
from app.modules.pulse import service as pulse_svc
from app.modules.work_requests.helpers import (
    default_due_date_for_priority,
    display_status,
    merge_wr_settings,
)
from app.schemas.work_requests import (
    WorkRequestActivityOut,
    WorkRequestAssignIn,
    WorkRequestCommentIn,
    WorkRequestCommentOut,
    WorkRequestCreateIn,
    WorkRequestDetailOut,
    WorkRequestListOut,
    WorkRequestPatchIn,
    WorkRequestRowOut,
    WorkRequestSettingsOut,
    WorkRequestSettingsPatchIn,
    WorkRequestStatusIn,
)

router = APIRouter(prefix="/work-requests", tags=["work-requests"])


async def resolve_wr_company_id(
    user: Annotated[User, Depends(get_current_user)],
    company_id: Optional[str] = Query(None, description="Required for system administrators"),
) -> str:
    if user_has_any_role(user, UserRole.system_admin) or user.is_system_admin:
        if not company_id:
            raise HTTPException(status_code=400, detail="company_id is required for system administrators")
        return company_id
    if user.company_id is None:
        raise HTTPException(status_code=403, detail="Not a tenant user")
    cid = str(user.company_id)
    if company_id is not None and company_id != cid:
        raise HTTPException(status_code=403, detail="Company access denied")
    return cid


CompanyId = Annotated[str, Depends(resolve_wr_company_id)]
Db = Annotated[AsyncSession, Depends(get_db)]
MgrUser = Annotated[User, Depends(require_manager_or_above)]


async def _require_wr_reader(user: Annotated[User, Depends(get_current_user)]) -> User:
    """Workers, managers, company admins, and system admins (with company context) may read/list issues."""
    if user_has_any_role(user, UserRole.system_admin) or user.is_system_admin:
        return user
    if user.company_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a tenant user")
    if not user_has_any_role(
        user,
        UserRole.worker,
        UserRole.lead,
        UserRole.supervisor,
        UserRole.manager,
        UserRole.company_admin,
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Issue tracking not available for this role")
    return user


WrReader = Annotated[User, Depends(_require_wr_reader)]


def _assert_worker_may_touch_wr(user: User, wr: PulseWorkRequest) -> None:
    """Field workers and leads may update issues assigned to them or still unassigned."""
    if not is_field_worker_like(user):
        return
    if wr.assigned_user_id is None or wr.assigned_user_id == user.id:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="This issue is assigned to another user",
    )


async def _tool_zone_maps(
    db: AsyncSession, cid: str
) -> tuple[dict[str, Tool], dict[str, Zone]]:
    tq = await db.execute(select(Tool).where(Tool.company_id == cid))
    tools = {t.id: t for t in tq.scalars().all()}
    zq = await db.execute(select(Zone).where(Zone.company_id == cid))
    zones = {z.id: z for z in zq.scalars().all()}
    return tools, zones


async def _equipment_map(db: AsyncSession, cid: str) -> dict[str, FacilityEquipment]:
    q = await db.execute(select(FacilityEquipment).where(FacilityEquipment.company_id == cid))
    return {e.id: e for e in q.scalars().all()}


async def _equipment_parts_map(db: AsyncSession, cid: str) -> dict[str, EquipmentPart]:
    q = await db.execute(select(EquipmentPart).where(EquipmentPart.company_id == cid))
    return {p.id: p for p in q.scalars().all()}


async def _users_map(db: AsyncSession, cid: str) -> dict[str, User]:
    uq = await db.execute(
        select(User).where(User.company_id == cid, User.is_active.is_(True))
    )
    return {u.id: u for u in uq.scalars().all()}


async def _resolve_wr_part_equipment_ids(
    db: AsyncSession, cid: str, part_id: Optional[str], equipment_id: Optional[str]
) -> tuple[Optional[str], Optional[str]]:
    if not part_id:
        return None, equipment_id
    part = await pulse_svc.equipment_part_for_company(db, cid, part_id)
    if not part:
        raise HTTPException(status_code=400, detail="Unknown part")
    if equipment_id and equipment_id != part.equipment_id:
        raise HTTPException(status_code=400, detail="Part does not belong to selected equipment")
    return part_id, equipment_id or part.equipment_id


async def _get_settings_row(db: AsyncSession, cid: str) -> Optional[PulseWorkRequestSettings]:
    q = await db.execute(select(PulseWorkRequestSettings).where(PulseWorkRequestSettings.company_id == cid))
    return q.scalar_one_or_none()


async def _settings_merged(db: AsyncSession, cid: str) -> dict[str, Any]:
    row = await _get_settings_row(db, cid)
    return merge_wr_settings(row.settings if row else None)


async def _org_module_merged(db: AsyncSession, cid: str) -> dict[str, Any]:
    q = await db.execute(select(PulseOrgModuleSettings).where(PulseOrgModuleSettings.company_id == cid))
    row = q.scalar_one_or_none()
    return merge_org_module_settings(row.settings if row else None)


def _work_request_rules_from_org(org: dict[str, Any]) -> dict[str, Any]:
    raw = org.get("workRequests")
    return raw if isinstance(raw, dict) else {}


def _assert_wr_org_status_change(
    user: User,
    wr: PulseWorkRequest,
    old_status: PulseWorkRequestStatus,
    new_status: PulseWorkRequestStatus,
    rules: dict[str, Any],
) -> None:
    if new_status == PulseWorkRequestStatus.completed and old_status != PulseWorkRequestStatus.completed:
        if rules.get("requirePhotoOnClose"):
            atts = list(wr.attachments or [])
            if len(atts) < 1:
                raise HTTPException(
                    status_code=400,
                    detail="Attachment required before closing this work order",
                )
    if old_status == PulseWorkRequestStatus.completed and new_status != PulseWorkRequestStatus.completed:
        if not rules.get("lockAfterCompletion"):
            return
        if user.is_system_admin or user_has_any_role(user, UserRole.system_admin, UserRole.company_admin):
            return
        if rules.get("allowManualOverride") and user_has_any_role(user, UserRole.manager, UserRole.supervisor):
            return
        raise HTTPException(status_code=403, detail="This work order is locked after completion")


def _row_out(
    wr: PulseWorkRequest,
    *,
    users: dict[str, User],
    tools: dict[str, Tool],
    zones: dict[str, Zone],
    equipment: dict[str, FacilityEquipment],
    parts: dict[str, EquipmentPart],
    now: datetime,
) -> WorkRequestRowOut:
    t = tools.get(wr.tool_id) if wr.tool_id else None
    z = zones.get(wr.zone_id) if wr.zone_id else None
    eq = equipment.get(wr.equipment_id) if wr.equipment_id else None
    pr = parts.get(wr.part_id) if wr.part_id else None
    au = users.get(wr.assigned_user_id) if wr.assigned_user_id else None
    disp = display_status(wr, now)
    overdue = disp == "overdue"
    return WorkRequestRowOut(
        id=wr.id,
        company_id=wr.company_id,
        title=wr.title,
        description=wr.description,
        tool_id=wr.tool_id,
        asset_name=t.name if t else None,
        asset_tag=t.tag_id if t else None,
        equipment_id=wr.equipment_id,
        equipment_name=eq.name if eq else None,
        part_id=wr.part_id,
        part_name=pr.name if pr else None,
        zone_id=wr.zone_id,
        location_name=z.name if z else None,
        category=wr.category,
        priority=wr.priority.value,
        status=wr.status.value,
        display_status=disp,
        assigned_user_id=wr.assigned_user_id,
        assignee_name=au.full_name if au else None,
        assignee_email=au.email if au else None,
        due_date=wr.due_date,
        is_overdue=overdue,
        completed_at=wr.completed_at,
        created_by_user_id=wr.created_by_user_id,
        created_at=wr.created_at,
        updated_at=wr.updated_at,
    )


async def _log(db: AsyncSession, wr_id: str, action: str, uid: Optional[str], meta: dict[str, Any]) -> None:
    db.add(
        PulseWorkRequestActivity(
            id=str(uuid4()),
            work_request_id=wr_id,
            action=action,
            performed_by=uid,
            meta=meta or {},
        )
    )


def _status_change_meta(
    old: PulseWorkRequestStatus,
    new: PulseWorkRequestStatus,
    *,
    note: Optional[str],
    hold_reason: Optional[str],
) -> dict[str, Any]:
    """Extra fields for activity history (stored on `status_changed`)."""
    meta: dict[str, Any] = {"from": old.value, "to": new.value}
    if new == PulseWorkRequestStatus.cancelled and note:
        meta["close_reason"] = note
    if new == PulseWorkRequestStatus.hold:
        if hold_reason:
            meta["hold_reason"] = hold_reason
        if note:
            meta["note"] = note
    return meta


async def _get_wr(db: AsyncSession, cid: str, wr_id: str) -> PulseWorkRequest:
    wr = await db.get(PulseWorkRequest, wr_id)
    if not wr or wr.company_id != cid:
        raise HTTPException(status_code=404, detail="Work request not found")
    return wr


@router.get("/settings", response_model=WorkRequestSettingsOut)
async def get_settings(db: Db, _: MgrUser, cid: CompanyId) -> WorkRequestSettingsOut:
    return WorkRequestSettingsOut(settings=await _settings_merged(db, cid))


@router.patch("/settings", response_model=WorkRequestSettingsOut)
async def patch_settings(
    db: Db,
    _: MgrUser,
    cid: CompanyId,
    body: WorkRequestSettingsPatchIn,
) -> WorkRequestSettingsOut:
    row = await _get_settings_row(db, cid)
    base = merge_wr_settings(row.settings if row else None)
    for k, v in body.settings.items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            merged = dict(base[k])
            merged.update(v)
            base[k] = merged
        else:
            base[k] = v
    if row:
        row.settings = base
    else:
        db.add(
            PulseWorkRequestSettings(
                id=str(uuid4()),
                company_id=cid,
                settings=base,
            )
        )
    await db.commit()
    return WorkRequestSettingsOut(settings=base)


@router.get("", response_model=WorkRequestListOut)
async def list_work_requests(
    db: Db,
    _: WrReader,
    cid: CompanyId,
    q: Optional[str] = Query(None, description="Search title/description/category"),
    status_filter: Optional[str] = Query(None, alias="status"),
    priority: Optional[str] = Query(None),
    zone_id: Optional[str] = Query(None),
    assigned_user_id: Optional[str] = Query(
        None,
        description="Filter by assignee (use current user id for “assigned to me”)",
    ),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    due_after: Optional[datetime] = Query(None, description="Filter by due_date >= (UTC)"),
    due_before: Optional[datetime] = Query(None, description="Filter by due_date <= (UTC)"),
    hub_category: Optional[str] = Query(
        None,
        description="Optional hub facet: preventative | work_requests | projects",
    ),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> WorkRequestListOut:
    now = datetime.now(timezone.utc)
    conds = [PulseWorkRequest.company_id == cid]

    if q and q.strip():
        like = f"%{q.strip()}%"
        conds.append(
            or_(
                PulseWorkRequest.title.ilike(like),
                PulseWorkRequest.description.ilike(like),
                PulseWorkRequest.category.ilike(like),
            )
        )
    if priority:
        try:
            pr = PulseWorkRequestPriority(priority)
            conds.append(PulseWorkRequest.priority == pr)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid priority")
    if zone_id:
        conds.append(PulseWorkRequest.zone_id == zone_id)
    if assigned_user_id:
        conds.append(PulseWorkRequest.assigned_user_id == assigned_user_id)
    if date_from:
        conds.append(PulseWorkRequest.created_at >= date_from)
    if date_to:
        conds.append(PulseWorkRequest.created_at <= date_to)
    if due_after:
        conds.append(PulseWorkRequest.due_date.isnot(None))
        conds.append(PulseWorkRequest.due_date >= due_after)
    if due_before:
        conds.append(PulseWorkRequest.due_date.isnot(None))
        conds.append(PulseWorkRequest.due_date <= due_before)

    if hub_category:
        hc = hub_category.strip().lower()
        if hc == "preventative":
            conds.append(PulseWorkRequest.work_order_type == PulseWorkOrderType.preventative)
        elif hc in ("work_requests", "work_request"):
            conds.append(
                PulseWorkRequest.work_order_type.in_((PulseWorkOrderType.issue, PulseWorkOrderType.request))
            )
        elif hc == "projects":
            conds.append(
                or_(
                    func.lower(PulseWorkRequest.category) == "project",
                    func.lower(PulseWorkRequest.category) == "projects",
                )
            )
        else:
            raise HTTPException(status_code=400, detail="Invalid hub_category")

    if status_filter:
        if status_filter == "overdue":
            conds.append(PulseWorkRequest.due_date.isnot(None))
            conds.append(PulseWorkRequest.due_date < now)
            conds.append(PulseWorkRequest.status != PulseWorkRequestStatus.completed)
            conds.append(PulseWorkRequest.status != PulseWorkRequestStatus.cancelled)
            conds.append(PulseWorkRequest.status != PulseWorkRequestStatus.hold)
        else:
            try:
                st = PulseWorkRequestStatus(status_filter)
                conds.append(PulseWorkRequest.status == st)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid status")

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
    rows = list((await db.execute(stmt)).scalars().all())

    users = await _users_map(db, cid)
    tools, zones = await _tool_zone_maps(db, cid)
    equipment = await _equipment_map(db, cid)
    parts = await _equipment_parts_map(db, cid)
    items = [
        _row_out(wr, users=users, tools=tools, zones=zones, equipment=equipment, parts=parts, now=now) for wr in rows
    ]

    occ_stmt = select(func.count()).select_from(PulseWorkRequest).where(
        PulseWorkRequest.company_id == cid,
        PulseWorkRequest.priority == PulseWorkRequestPriority.critical,
        PulseWorkRequest.due_date.isnot(None),
        PulseWorkRequest.due_date < now,
        PulseWorkRequest.status != PulseWorkRequestStatus.completed,
        PulseWorkRequest.status != PulseWorkRequestStatus.cancelled,
        PulseWorkRequest.status != PulseWorkRequestStatus.hold,
    )
    occ = int((await db.execute(occ_stmt)).scalar_one() or 0)

    return WorkRequestListOut(items=items, total=total, overdue_critical_count=occ)


@router.post("", response_model=WorkRequestDetailOut, status_code=status.HTTP_201_CREATED)
async def create_wr(
    db: Db,
    user: WrReader,
    cid: CompanyId,
    body: WorkRequestCreateIn,
) -> WorkRequestDetailOut:
    if body.tool_id and not await pulse_svc.tool_in_company(db, cid, body.tool_id):
        raise HTTPException(status_code=400, detail="Unknown asset")
    resolved_part_id, resolved_equipment_id = await _resolve_wr_part_equipment_ids(
        db, cid, body.part_id, body.equipment_id
    )
    if resolved_equipment_id and not await pulse_svc.facility_equipment_in_company(db, cid, resolved_equipment_id):
        raise HTTPException(status_code=400, detail="Unknown equipment")
    if body.zone_id and not await pulse_svc.zone_in_company(db, cid, body.zone_id):
        raise HTTPException(status_code=400, detail="Unknown zone")
    if body.assigned_user_id and not await pulse_svc._user_in_company(db, cid, body.assigned_user_id):
        raise HTTPException(status_code=400, detail="Unknown assignee")

    settings = await _settings_merged(db, cid)
    org_mod = await _org_module_merged(db, cid)
    wr_rules = _work_request_rules_from_org(org_mod)
    eff_priority = body.priority
    if wr_rules.get("enablePriorityLevels") is False:
        eff_priority = PulseWorkRequestPriority.medium

    due = body.due_date
    if due is None:
        due = default_due_date_for_priority(eff_priority, settings)

    assignee_id = body.assigned_user_id
    if assignee_id is None and wr_rules.get("autoAssignTechnician"):
        assignee_id = user.id

    att = body.attachments if body.attachments is not None else []
    wr = PulseWorkRequest(
        id=str(uuid4()),
        company_id=cid,
        title=body.title.strip(),
        description=body.description,
        tool_id=body.tool_id,
        equipment_id=resolved_equipment_id,
        part_id=resolved_part_id,
        zone_id=body.zone_id,
        category=body.category,
        priority=eff_priority,
        assigned_user_id=assignee_id,
        created_by_user_id=user.id,
        due_date=due,
        attachments=list(att),
    )
    db.add(wr)
    await db.flush()
    await _log(db, wr.id, "created", user.id, {"title": wr.title})
    if not is_field_worker_like(user):
        await try_mark_onboarding_step(db, user.id, "create_work_order")
        await try_mark_onboarding_step(db, user.id, "customize_workflow")
    await db.commit()
    await db.refresh(wr)
    return await _detail(db, cid, wr.id, user.id)


async def _detail(db: AsyncSession, cid: str, wr_id: str, _: Optional[str] = None) -> WorkRequestDetailOut:
    wr = await _get_wr(db, cid, wr_id)
    now = datetime.now(timezone.utc)
    users = await _users_map(db, cid)
    tools, zones = await _tool_zone_maps(db, cid)
    equipment = await _equipment_map(db, cid)
    parts = await _equipment_parts_map(db, cid)
    base = _row_out(wr, users=users, tools=tools, zones=zones, equipment=equipment, parts=parts, now=now)

    cq = await db.execute(
        select(PulseWorkRequestComment)
        .where(PulseWorkRequestComment.work_request_id == wr_id)
        .order_by(PulseWorkRequestComment.created_at)
    )
    comments: list[WorkRequestCommentOut] = []
    for c in cq.scalars().all():
        u = users.get(c.user_id)
        comments.append(
            WorkRequestCommentOut(
                id=c.id,
                user_id=c.user_id,
                user_name=u.full_name if u else None,
                message=c.message,
                created_at=c.created_at,
            )
        )

    aq = await db.execute(
        select(PulseWorkRequestActivity)
        .where(PulseWorkRequestActivity.work_request_id == wr_id)
        .order_by(PulseWorkRequestActivity.created_at.desc())
    )
    activity: list[WorkRequestActivityOut] = []
    for a in aq.scalars().all():
        pu = users.get(a.performed_by) if a.performed_by else None
        activity.append(
            WorkRequestActivityOut(
                id=a.id,
                action=a.action,
                performed_by=a.performed_by,
                performer_name=pu.full_name if pu else None,
                meta=dict(a.meta or {}),
                created_at=a.created_at,
            )
        )

    return WorkRequestDetailOut(
        **base.model_dump(),
        attachments=list(wr.attachments or []),
        comments=comments,
        activity=activity,
    )


@router.get("/{wr_id}", response_model=WorkRequestDetailOut)
async def get_wr(db: Db, _: WrReader, cid: CompanyId, wr_id: str) -> WorkRequestDetailOut:
    return await _detail(db, cid, wr_id)


@router.patch("/{wr_id}", response_model=WorkRequestDetailOut)
async def patch_wr(
    db: Db,
    user: Annotated[User, Depends(get_current_user)],
    cid: CompanyId,
    wr_id: str,
    body: WorkRequestPatchIn,
) -> WorkRequestDetailOut:
    wr = await _get_wr(db, cid, wr_id)
    data = body.model_dump(exclude_unset=True)
    note_ctx = data.pop("note", None)
    hold_reason_ctx = data.pop("hold_reason", None)
    note_s = (str(note_ctx).strip() if note_ctx is not None else "") or None
    hold_reason_s = (str(hold_reason_ctx).strip() if hold_reason_ctx is not None else "") or None

    if is_field_worker_like(user):
        _assert_worker_may_touch_wr(user, wr)
        extra = set(data.keys()) - {"attachments"}
        if extra:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Workers may only update attachments on this endpoint",
            )
        if "attachments" in data:
            wr.attachments = list(data["attachments"] or [])
        await db.commit()
        await db.refresh(wr)
        return await _detail(db, cid, wr_id)

    if not user_has_any_role(
        user,
        UserRole.system_admin,
        UserRole.company_admin,
        UserRole.manager,
        UserRole.supervisor,
    ) and not user.is_system_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="manager or above required")
    if "tool_id" in data and data["tool_id"] and not await pulse_svc.tool_in_company(db, cid, data["tool_id"]):
        raise HTTPException(status_code=400, detail="Unknown asset")
    if "equipment_id" in data and data["equipment_id"]:
        if not await pulse_svc.facility_equipment_in_company(db, cid, data["equipment_id"]):
            raise HTTPException(status_code=400, detail="Unknown equipment")
    if "zone_id" in data and data["zone_id"] and not await pulse_svc.zone_in_company(db, cid, data["zone_id"]):
        raise HTTPException(status_code=400, detail="Unknown zone")
    if "assigned_user_id" in data and data["assigned_user_id"]:
        if not await pulse_svc._user_in_company(db, cid, data["assigned_user_id"]):
            raise HTTPException(status_code=400, detail="Unknown assignee")

    old_status = wr.status
    new_status = data.get("status")
    if "status" in data and new_status != old_status:
        org_mod = await _org_module_merged(db, cid)
        wr_rules = _work_request_rules_from_org(org_mod)
        _assert_wr_org_status_change(user, wr, old_status, new_status, wr_rules)
        if new_status == PulseWorkRequestStatus.cancelled and not note_s:
            raise HTTPException(status_code=400, detail="Close reason is required")
        if new_status == PulseWorkRequestStatus.hold and not hold_reason_s:
            raise HTTPException(status_code=400, detail="Hold reason is required")
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
    if "status" in data and data["status"] == PulseWorkRequestStatus.completed:
        wr.completed_at = datetime.now(timezone.utc)
    if "status" in data and data["status"] != PulseWorkRequestStatus.completed:
        wr.completed_at = None
    if "status" in data and data["status"] != old_status:
        await _log(
            db,
            wr_id,
            "status_changed",
            user.id,
            _status_change_meta(
                old_status,
                wr.status,
                note=note_s,
                hold_reason=hold_reason_s,
            ),
        )
    if (
        "status" in data
        and data["status"] == PulseWorkRequestStatus.completed
        and old_status != PulseWorkRequestStatus.completed
    ):
        await sync_pm_task_after_work_order_completed(db, wr)
        await try_mark_onboarding_step(db, user.id, "complete_work_order")
    await db.commit()
    await db.refresh(wr)
    return await _detail(db, cid, wr_id)


@router.delete("/{wr_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_wr(db: Db, _: MgrUser, cid: CompanyId, wr_id: str) -> None:
    wr = await _get_wr(db, cid, wr_id)
    await db.execute(delete(PulseWorkRequest).where(PulseWorkRequest.id == wr.id))
    await db.commit()


@router.post("/{wr_id}/comment", response_model=WorkRequestDetailOut)
async def post_comment(
    db: Db,
    user: WrReader,
    cid: CompanyId,
    wr_id: str,
    body: WorkRequestCommentIn,
) -> WorkRequestDetailOut:
    wr = await _get_wr(db, cid, wr_id)
    _assert_worker_may_touch_wr(user, wr)
    db.add(
        PulseWorkRequestComment(
            id=str(uuid4()),
            work_request_id=wr_id,
            user_id=user.id,
            message=body.message.strip(),
        )
    )
    await _log(db, wr_id, "comment", user.id, {})
    await db.commit()
    return await _detail(db, cid, wr_id)


@router.post("/{wr_id}/assign", response_model=WorkRequestDetailOut)
async def post_assign(
    db: Db,
    user: MgrUser,
    cid: CompanyId,
    wr_id: str,
    body: WorkRequestAssignIn,
) -> WorkRequestDetailOut:
    wr = await _get_wr(db, cid, wr_id)
    uid = body.user_id
    if uid and not await pulse_svc._user_in_company(db, cid, uid):
        raise HTTPException(status_code=400, detail="Unknown assignee")
    wr.assigned_user_id = uid
    await _log(db, wr_id, "assigned", user.id, {"user_id": uid})
    await db.commit()
    await db.refresh(wr)
    return await _detail(db, cid, wr_id)


@router.post("/{wr_id}/status", response_model=WorkRequestDetailOut)
async def post_status(
    db: Db,
    user: WrReader,
    cid: CompanyId,
    wr_id: str,
    body: WorkRequestStatusIn,
) -> WorkRequestDetailOut:
    wr = await _get_wr(db, cid, wr_id)
    _assert_worker_may_touch_wr(user, wr)
    old = wr.status
    note_s = (body.note or "").strip() or None
    hold_reason_s = (body.hold_reason or "").strip() or None
    if body.status == PulseWorkRequestStatus.cancelled and not note_s:
        raise HTTPException(status_code=400, detail="Close reason is required")
    if body.status == PulseWorkRequestStatus.hold and not hold_reason_s:
        raise HTTPException(status_code=400, detail="Hold reason is required")
    org_mod = await _org_module_merged(db, cid)
    wr_rules = _work_request_rules_from_org(org_mod)
    _assert_wr_org_status_change(user, wr, old, body.status, wr_rules)
    wr.status = body.status
    if body.status == PulseWorkRequestStatus.completed:
        wr.completed_at = datetime.now(timezone.utc)
    else:
        wr.completed_at = None
    await _log(
        db,
        wr_id,
        "status_changed",
        user.id,
        _status_change_meta(old, body.status, note=note_s, hold_reason=hold_reason_s),
    )
    await db.commit()
    await db.refresh(wr)
    return await _detail(db, cid, wr_id)
