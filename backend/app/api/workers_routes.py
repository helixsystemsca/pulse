"""
Workers & roles under `/api/workers`.

HR tables + company settings; multi-tenant with optional `company_id` for system administrators.
"""

from __future__ import annotations

import copy
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any, Optional
from urllib.parse import quote
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.dialects.postgresql import array as pg_array
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_manager_or_above
from app.core.user_roles import (
    primary_jwt_role,
    user_has_any_role,
    user_roles_subset_of,
    validate_tenant_roles_non_empty,
)
from app.core.config import get_settings
from app.core.email_smtp import send_employee_invite
from app.core.system_tokens import generate_raw_token, hash_system_token
from app.models.domain import (
    Company,
    ComplianceRecord,
    ComplianceRecordStatus,
    User,
    UserAccountStatus,
    UserRole,
)
from app.models.pulse_models import (
    PulseWorkerCertification,
    PulseWorkerHR,
    PulseWorkerProfile,
    PulseWorkerSkill,
    PulseWorkerTraining,
    PulseWorkersSettings,
    PulseWorkRequest,
    PulseWorkRequestStatus,
)
from app.modules.compliance.service import effective_status, repeat_offender_user_ids
from app.modules.pulse import service as pulse_svc
from app.schemas.pulse_workers import (
    WorkerCertificationOut,
    WorkerComplianceSummaryOut,
    WorkerCreateIn,
    WorkerCreateResultOut,
    WorkerDetailOut,
    WorkerListOut,
    WorkerPatchIn,
    WorkerRowOut,
    WorkersSettingsOut,
    WorkersSettingsPatchIn,
    WorkerSkillOut,
    WorkerTrainingOut,
    WorkerWorkSummaryOut,
)

router = APIRouter(prefix="/workers", tags=["workers"])

DEFAULT_WORKERS_SETTINGS: dict[str, Any] = {
    "permission_matrix": {
        "view_tools": True,
        "assign_jobs": True,
        "manage_inventory": False,
        "manage_work_requests": True,
        "view_reports": True,
    },
    "roles": [
        {"key": "company_admin", "label": "Company Admin"},
        {"key": "manager", "label": "Manager"},
        {"key": "supervisor", "label": "Supervisor"},
        {"key": "lead", "label": "Lead"},
        {"key": "worker", "label": "Worker"},
    ],
    "shifts": [
        {"key": "day", "label": "Day shift"},
        {"key": "night", "label": "Night shift"},
        {"key": "custom", "label": "Custom"},
    ],
    "skill_categories": ["Welding", "Electrical", "HVAC", "Safety"],
    "certification_rules": [],
}


def merge_workers_settings(raw: Optional[dict[str, Any]]) -> dict[str, Any]:
    out = copy.deepcopy(DEFAULT_WORKERS_SETTINGS)
    if not raw:
        return out
    for k, v in raw.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            merged = dict(out[k])
            merged.update(v)
            out[k] = merged
        else:
            out[k] = v
    return out


async def resolve_workers_company_id(
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


CompanyId = Annotated[str, Depends(resolve_workers_company_id)]
Db = Annotated[AsyncSession, Depends(get_db)]
MgrUser = Annotated[User, Depends(require_manager_or_above)]

_ROSTER_ROLES = (
    UserRole.company_admin,
    UserRole.manager,
    UserRole.supervisor,
    UserRole.lead,
    UserRole.worker,
)


def _employee_join_path(raw_token: str) -> str:
    return f"/join?token={quote(raw_token, safe='')}"


def _pulse_public_link(path: str) -> str:
    base = get_settings().pulse_app_public_origin.rstrip("/")
    return f"{base}{path if path.startswith('/') else '/' + path}"


async def _assert_valid_supervisor(db: AsyncSession, cid: str, supervisor_id: Optional[str]) -> None:
    if not supervisor_id:
        return
    u = await pulse_svc._user_in_company(db, cid, supervisor_id)
    if not u:
        raise HTTPException(status_code=400, detail="Unknown supervisor")
    if u.account_status != UserAccountStatus.active or not u.is_active:
        raise HTTPException(status_code=400, detail="Supervisor must be an active user")
    if not user_has_any_role(u, UserRole.supervisor, UserRole.manager):
        raise HTTPException(status_code=400, detail="Supervisor must have role supervisor or manager")


def _cert_status(expiry: Optional[datetime], now: datetime) -> str:
    if expiry is None:
        return "no_expiry"
    return "expired" if expiry < now else "valid"


async def _users_by_company(db: AsyncSession, cid: str) -> dict[str, User]:
    q = await db.execute(
        select(User).where(
            User.company_id == cid,
            User.roles.overlap(pg_array([r.value for r in _ROSTER_ROLES])),
        )
    )
    return {u.id: u for u in q.scalars().all()}


async def _compliance_summary(db: AsyncSession, cid: str, user_id: str, now: datetime) -> WorkerComplianceSummaryOut:
    window_start = now - timedelta(days=90)
    ro = await repeat_offender_user_ids(db, cid, now)
    q = await db.execute(
        select(ComplianceRecord).where(
            ComplianceRecord.company_id == cid,
            ComplianceRecord.user_id == user_id,
            ComplianceRecord.created_at >= window_start,
        )
    )
    rows = list(q.scalars().all())
    total = len(rows)
    completed = sum(
        1 for r in rows if r.status == ComplianceRecordStatus.completed and not r.ignored
    )
    missed = sum(
        1
        for r in rows
        if effective_status(r, now) in ("overdue", "ignored")
    )
    flagged = sum(1 for r in rows if r.flagged)
    rate = round((completed / total * 100.0) if total > 0 else 100.0, 1)
    return WorkerComplianceSummaryOut(
        compliance_rate_pct=rate,
        missed_acknowledgments=missed,
        repeat_offender=user_id in ro,
        flagged_count=flagged,
    )


async def _work_summary(db: AsyncSession, cid: str, user_id: str, now: datetime) -> WorkerWorkSummaryOut:
    window_start = now - timedelta(days=90)
    open_q = await db.execute(
        select(func.count())
        .select_from(PulseWorkRequest)
        .where(
            PulseWorkRequest.company_id == cid,
            PulseWorkRequest.assigned_user_id == user_id,
            PulseWorkRequest.status.in_((PulseWorkRequestStatus.open, PulseWorkRequestStatus.in_progress)),
        )
    )
    open_wr = int(open_q.scalar_one() or 0)

    done_q = await db.execute(
        select(func.count())
        .select_from(PulseWorkRequest)
        .where(
            PulseWorkRequest.company_id == cid,
            PulseWorkRequest.assigned_user_id == user_id,
            PulseWorkRequest.status == PulseWorkRequestStatus.completed,
            PulseWorkRequest.completed_at.isnot(None),
            PulseWorkRequest.completed_at >= window_start,
        )
    )
    done = int(done_q.scalar_one() or 0)

    avg_q = await db.execute(
        select(func.avg(func.extract("epoch", PulseWorkRequest.completed_at - PulseWorkRequest.created_at))).where(
            PulseWorkRequest.company_id == cid,
            PulseWorkRequest.assigned_user_id == user_id,
            PulseWorkRequest.status == PulseWorkRequestStatus.completed,
            PulseWorkRequest.completed_at.isnot(None),
            PulseWorkRequest.completed_at >= window_start,
        )
    )
    avg_sec = avg_q.scalar_one_or_none()
    avg_h = round(float(avg_sec) / 3600.0, 2) if avg_sec is not None else None

    return WorkerWorkSummaryOut(
        open_work_requests=open_wr,
        completed_tasks=done,
        avg_completion_hours=avg_h,
    )


async def _get_hr(db: AsyncSession, user_id: str) -> Optional[PulseWorkerHR]:
    return await db.get(PulseWorkerHR, user_id)


async def _ensure_profile(db: AsyncSession, cid: str, user_id: str) -> PulseWorkerProfile:
    q = await db.execute(
        select(PulseWorkerProfile).where(
            PulseWorkerProfile.user_id == user_id,
            PulseWorkerProfile.company_id == cid,
        )
    )
    prof = q.scalar_one_or_none()
    if prof:
        return prof
    prof = PulseWorkerProfile(id=str(uuid4()), company_id=cid, user_id=user_id)
    db.add(prof)
    await db.flush()
    return prof


async def _sync_structured_certs(
    db: AsyncSession,
    cid: str,
    user_id: str,
    items: list[Any],
) -> None:
    await db.execute(
        delete(PulseWorkerCertification).where(
            PulseWorkerCertification.user_id == user_id,
            PulseWorkerCertification.company_id == cid,
        )
    )
    for c in items:
        db.add(
            PulseWorkerCertification(
                id=str(uuid4()),
                company_id=cid,
                user_id=user_id,
                name=c.name.strip(),
                expiry_date=c.expiry_date,
            )
        )
    names = [c.name.strip() for c in items]
    prof = await _ensure_profile(db, cid, user_id)
    prof.certifications = names
    await db.flush()


async def _sync_skills(db: AsyncSession, cid: str, user_id: str, items: list[Any]) -> None:
    await db.execute(
        delete(PulseWorkerSkill).where(
            PulseWorkerSkill.user_id == user_id,
            PulseWorkerSkill.company_id == cid,
        )
    )
    for s in items:
        db.add(
            PulseWorkerSkill(
                id=str(uuid4()),
                company_id=cid,
                user_id=user_id,
                name=s.name.strip(),
                level=int(s.level),
            )
        )


async def _sync_training(db: AsyncSession, cid: str, user_id: str, items: list[Any]) -> None:
    await db.execute(
        delete(PulseWorkerTraining).where(
            PulseWorkerTraining.user_id == user_id,
            PulseWorkerTraining.company_id == cid,
        )
    )
    for t in items:
        db.add(
            PulseWorkerTraining(
                id=str(uuid4()),
                company_id=cid,
                user_id=user_id,
                name=t.name.strip(),
                completed_at=t.completed_at,
            )
        )


def _patch_actor_can_touch_target(actor: User, target: User) -> None:
    if user_has_any_role(actor, UserRole.system_admin) or actor.is_system_admin:
        return
    if user_has_any_role(actor, UserRole.company_admin):
        return
    if user_has_any_role(actor, UserRole.manager, UserRole.supervisor):
        if not user_roles_subset_of(target, (UserRole.worker, UserRole.lead)):
            raise HTTPException(status_code=403, detail="Managers and supervisors may only edit workers or leads")
        return
    raise HTTPException(status_code=403, detail="Not allowed")


async def _build_detail(db: AsyncSession, cid: str, u: User, users_map: dict[str, User]) -> WorkerDetailOut:
    now = datetime.now(timezone.utc)
    hr = await _get_hr(db, u.id)
    prof = await db.execute(
        select(PulseWorkerProfile).where(
            PulseWorkerProfile.user_id == u.id,
            PulseWorkerProfile.company_id == cid,
        )
    )
    p = prof.scalar_one_or_none()

    cq = await db.execute(
        select(PulseWorkerCertification)
        .where(
            PulseWorkerCertification.user_id == u.id,
            PulseWorkerCertification.company_id == cid,
        )
        .order_by(PulseWorkerCertification.name)
    )
    cert_rows = []
    for r in cq.scalars().all():
        cert_rows.append(
            WorkerCertificationOut(
                id=r.id,
                name=r.name,
                expiry_date=r.expiry_date,
                status=_cert_status(r.expiry_date, now),
            )
        )
    legacy = list(p.certifications or []) if p else []
    for legacy_name in legacy:
        if not any(c.name == legacy_name for c in cert_rows):
            cert_rows.append(
                WorkerCertificationOut(
                    id=f"legacy-{legacy_name}",
                    name=legacy_name,
                    expiry_date=None,
                    status="no_expiry",
                )
            )

    sq = await db.execute(
        select(PulseWorkerSkill).where(
            PulseWorkerSkill.user_id == u.id,
            PulseWorkerSkill.company_id == cid,
        )
    )
    skill_rows = [
        WorkerSkillOut(id=s.id, name=s.name, level=s.level) for s in sq.scalars().all()
    ]

    tq = await db.execute(
        select(PulseWorkerTraining)
        .where(
            PulseWorkerTraining.user_id == u.id,
            PulseWorkerTraining.company_id == cid,
        )
        .order_by(PulseWorkerTraining.completed_at.desc())
    )
    training_rows = [
        WorkerTrainingOut(id=t.id, name=t.name, completed_at=t.completed_at)
        for t in tq.scalars().all()
    ]

    sup_name = None
    if hr and hr.supervisor_user_id:
        su = users_map.get(hr.supervisor_user_id)
        sup_name = su.full_name if su else None

    co = await _compliance_summary(db, cid, u.id, now)
    wo = await _work_summary(db, cid, u.id, now)

    return WorkerDetailOut(
        id=u.id,
        company_id=str(u.company_id) if u.company_id else cid,
        email=u.email,
        full_name=u.full_name,
        role=primary_jwt_role(u).value,
        roles=list(u.roles),
        is_active=u.is_active,
        account_status=u.account_status.value,
        phone=hr.phone if hr else None,
        department=hr.department if hr else None,
        job_title=hr.job_title if hr else None,
        shift=hr.shift if hr else None,
        supervisor_id=hr.supervisor_user_id if hr else None,
        supervisor_name=sup_name,
        start_date=hr.start_date if hr else None,
        certifications=cert_rows,
        skills=skill_rows,
        training=training_rows,
        legacy_certifications=list(legacy),
        availability=dict(p.availability or {}) if p else {},
        profile_notes=p.notes if p else None,
        supervisor_notes=hr.supervisor_notes if hr else None,
        compliance_summary=co,
        work_summary=wo,
        created_at=u.created_at,
    )


async def _get_settings_row(db: AsyncSession, cid: str) -> Optional[PulseWorkersSettings]:
    q = await db.execute(select(PulseWorkersSettings).where(PulseWorkersSettings.company_id == cid))
    return q.scalar_one_or_none()


@router.get("/settings", response_model=WorkersSettingsOut)
async def get_workers_settings(db: Db, _: MgrUser, cid: CompanyId) -> WorkersSettingsOut:
    row = await _get_settings_row(db, cid)
    return WorkersSettingsOut(settings=merge_workers_settings(row.settings if row else None))


@router.patch("/settings", response_model=WorkersSettingsOut)
async def patch_workers_settings(
    db: Db,
    _: MgrUser,
    cid: CompanyId,
    body: WorkersSettingsPatchIn,
) -> WorkersSettingsOut:
    row = await _get_settings_row(db, cid)
    base = merge_workers_settings(row.settings if row else None)
    for k, v in body.settings.items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            m = dict(base[k])
            m.update(v)
            base[k] = m
        else:
            base[k] = v
    if row:
        row.settings = base
    else:
        db.add(PulseWorkersSettings(id=str(uuid4()), company_id=cid, settings=base))
    await db.commit()
    return WorkersSettingsOut(settings=base)


@router.get("", response_model=WorkerListOut)
async def list_workers(
    db: Db,
    _: MgrUser,
    cid: CompanyId,
    q: Optional[str] = Query(None),
    include_inactive: bool = Query(True),
) -> WorkerListOut:
    roster_vals = [r.value for r in _ROSTER_ROLES]
    stmt = select(User).where(
        User.company_id == cid,
        User.roles.overlap(pg_array(roster_vals)),
    )
    if not include_inactive:
        stmt = stmt.where(User.is_active.is_(True))
    if q and q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(User.email.ilike(like), User.full_name.ilike(like)))
    users = list((await db.execute(stmt)).scalars().all())
    rank = {"company_admin": 0, "manager": 1, "supervisor": 2, "lead": 3, "worker": 4}

    def _list_rank(u: User) -> int:
        return min((rank.get(r, 9) for r in u.roles), default=9)

    users.sort(key=lambda u: (_list_rank(u), (u.full_name or u.email or "").lower()))
    hr_map: dict[str, PulseWorkerHR] = {}
    if users:
        hid = [u.id for u in users]
        hq = await db.execute(select(PulseWorkerHR).where(PulseWorkerHR.user_id.in_(hid)))
        for h in hq.scalars().all():
            hr_map[h.user_id] = h
    items: list[WorkerRowOut] = []
    for u in users:
        h = hr_map.get(u.id)
        items.append(
            WorkerRowOut(
                id=u.id,
                email=u.email,
                full_name=u.full_name,
                role=primary_jwt_role(u).value,
                roles=list(u.roles),
                is_active=u.is_active,
                account_status=u.account_status.value,
                phone=h.phone if h else None,
                department=h.department if h else None,
                job_title=h.job_title if h else None,
            )
        )
    return WorkerListOut(items=items)


@router.get("/{user_id}/compliance-summary", response_model=WorkerComplianceSummaryOut)
async def worker_compliance_summary(db: Db, _: MgrUser, cid: CompanyId, user_id: str) -> WorkerComplianceSummaryOut:
    u = await pulse_svc._user_in_company(db, cid, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    return await _compliance_summary(db, cid, user_id, datetime.now(timezone.utc))


@router.get("/{user_id}/work-summary", response_model=WorkerWorkSummaryOut)
async def worker_work_summary(db: Db, _: MgrUser, cid: CompanyId, user_id: str) -> WorkerWorkSummaryOut:
    u = await pulse_svc._user_in_company(db, cid, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    return await _work_summary(db, cid, user_id, datetime.now(timezone.utc))


@router.get("/{user_id}", response_model=WorkerDetailOut)
async def get_worker(db: Db, _: MgrUser, cid: CompanyId, user_id: str) -> WorkerDetailOut:
    u = await pulse_svc._user_in_company(db, cid, user_id)
    roster_set = {r.value for r in _ROSTER_ROLES}
    if not u or not set(u.roles) & roster_set:
        raise HTTPException(status_code=404, detail="User not found")
    users_map = await _users_by_company(db, cid)
    return await _build_detail(db, cid, u, users_map)


def _company_admin_creatable_roles() -> frozenset[str]:
    return frozenset({"worker", "lead", "supervisor", "manager"})


def _manager_creatable_roles() -> frozenset[str]:
    return frozenset({"worker", "lead"})


async def _apply_worker_hr_and_extras(
    db: AsyncSession,
    cid: str,
    user: User,
    body: WorkerCreateIn,
    *,
    hr_row: PulseWorkerHR | None,
) -> None:
    if hr_row:
        hr_row.phone = body.phone
        hr_row.department = body.department
        hr_row.job_title = body.job_title
        hr_row.shift = body.shift
        hr_row.supervisor_user_id = body.supervisor_id
        hr_row.start_date = body.start_date
    else:
        db.add(
            PulseWorkerHR(
                user_id=user.id,
                company_id=cid,
                phone=body.phone,
                department=body.department,
                job_title=body.job_title,
                shift=body.shift,
                supervisor_user_id=body.supervisor_id,
                start_date=body.start_date,
            )
        )
    await _ensure_profile(db, cid, user.id)
    await db.flush()
    if body.certifications:
        await _sync_structured_certs(db, cid, user.id, body.certifications)
    if body.skills:
        await _sync_skills(db, cid, user.id, body.skills)
    if body.training:
        await _sync_training(db, cid, user.id, body.training)


@router.post("", response_model=WorkerCreateResultOut, status_code=status.HTTP_201_CREATED)
async def create_worker(
    db: Db,
    actor: MgrUser,
    cid: CompanyId,
    body: WorkerCreateIn,
    background_tasks: BackgroundTasks,
) -> WorkerCreateResultOut:
    if user_has_any_role(actor, UserRole.system_admin) or actor.is_system_admin:
        pass
    elif user_has_any_role(actor, UserRole.company_admin):
        if body.role not in _company_admin_creatable_roles():
            raise HTTPException(
                status_code=403,
                detail="company_admin may only invite workers, leads, supervisors, or managers",
            )
    elif user_has_any_role(actor, UserRole.manager):
        if body.role not in _manager_creatable_roles():
            raise HTTPException(status_code=403, detail="Managers may only invite workers or leads")
    elif user_has_any_role(actor, UserRole.supervisor):
        if body.role not in _manager_creatable_roles():
            raise HTTPException(status_code=403, detail="Supervisors may only invite workers or leads")
    else:
        raise HTTPException(status_code=403, detail="Not allowed to create users")

    email_norm = body.email.strip().lower()
    await _assert_valid_supervisor(db, cid, body.supervisor_id)

    role_enum = UserRole(body.role)
    settings = get_settings()
    exp = datetime.now(timezone.utc) + timedelta(hours=settings.system_invite_expire_hours)
    raw = generate_raw_token()
    token_hash = hash_system_token(raw)

    existing_q = await db.execute(select(User).where(func.lower(User.email) == email_norm))
    existing = existing_q.scalar_one_or_none()

    if existing:
        if str(existing.company_id) != cid:
            raise HTTPException(status_code=400, detail="Email already in use")
        if existing.account_status == UserAccountStatus.active:
            raise HTTPException(status_code=400, detail="Email already in use")
        user = existing
        user.roles = [role_enum.value]
        user.full_name = body.full_name
        user.account_status = UserAccountStatus.invited
        user.hashed_password = None
        user.invite_token_hash = token_hash
        user.invite_expires_at = exp
        user.is_active = True
        user.created_by = actor.id
    else:
        user = User(
            company_id=cid,
            email=email_norm,
            hashed_password=None,
            full_name=body.full_name,
            roles=[role_enum.value],
            created_by=actor.id,
            account_status=UserAccountStatus.invited,
            invite_token_hash=token_hash,
            invite_expires_at=exp,
            is_active=True,
        )
        db.add(user)
    await db.flush()

    hr = await _get_hr(db, user.id)
    await _apply_worker_hr_and_extras(db, cid, user, body, hr_row=hr)

    company = await db.get(Company, cid)
    co_name = company.name if company else "your organization"
    link_path = _employee_join_path(raw)
    invite_url = _pulse_public_link(link_path)

    invite_email_sent: bool | None = None
    if settings.smtp_configured:

        async def _send() -> None:
            cfg = get_settings()
            await send_employee_invite(
                cfg,
                to_email=email_norm,
                company_name=co_name,
                invite_url=invite_url,
            )

        background_tasks.add_task(_send)
        invite_email_sent = None
    else:
        invite_email_sent = False

    await db.commit()

    u2 = await pulse_svc._user_in_company(db, cid, user.id)
    assert u2
    users_map = await _users_by_company(db, cid)
    detail = await _build_detail(db, cid, u2, users_map)
    return WorkerCreateResultOut(
        worker=detail,
        invite_link_path=link_path,
        invite_email_sent=invite_email_sent,
        message="Invite sent",
    )


@router.post("/{user_id}/resend-invite", status_code=status.HTTP_200_OK)
async def resend_worker_invite(
    db: Db,
    actor: MgrUser,
    cid: CompanyId,
    user_id: str,
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    target = await pulse_svc._user_in_company(db, cid, user_id)
    rsr = {r.value for r in _ROSTER_ROLES}
    if not target or not set(target.roles) & rsr:
        raise HTTPException(status_code=404, detail="User not found")
    _patch_actor_can_touch_target(actor, target)
    if target.account_status != UserAccountStatus.invited:
        raise HTTPException(status_code=400, detail="User is not pending invite")
    settings = get_settings()
    raw = generate_raw_token()
    target.invite_token_hash = hash_system_token(raw)
    target.invite_expires_at = datetime.now(timezone.utc) + timedelta(hours=settings.system_invite_expire_hours)
    await db.commit()

    company = await db.get(Company, cid)
    co_name = company.name if company else "your organization"
    link_path = _employee_join_path(raw)
    invite_url = _pulse_public_link(link_path)
    invite_email_sent: bool | None = False
    if settings.smtp_configured:

        async def _send() -> None:
            cfg = get_settings()
            await send_employee_invite(
                cfg,
                to_email=target.email,
                company_name=co_name,
                invite_url=invite_url,
            )

        background_tasks.add_task(_send)
        invite_email_sent = None
    return {
        "invite_link_path": link_path,
        "invite_email_sent": invite_email_sent,
        "message": "Invite resent",
    }


@router.patch("/{user_id}", response_model=WorkerDetailOut)
async def patch_worker(
    db: Db,
    actor: MgrUser,
    cid: CompanyId,
    user_id: str,
    body: WorkerPatchIn,
) -> WorkerDetailOut:
    target = await pulse_svc._user_in_company(db, cid, user_id)
    rset2 = {r.value for r in _ROSTER_ROLES}
    if not target or not set(target.roles) & rset2:
        raise HTTPException(status_code=404, detail="User not found")

    _patch_actor_can_touch_target(actor, target)

    if user_has_any_role(actor, UserRole.manager) and user_id != actor.id:
        pass

    if user_has_any_role(target, UserRole.company_admin) and actor.id != target.id:
        if body.role is not None or body.roles is not None or body.is_active is not None:
            raise HTTPException(status_code=403, detail="Cannot change another company admin role or status here")

    data = body.model_dump(exclude_unset=True)

    if body.roles is not None:
        if not user_has_any_role(actor, UserRole.company_admin):
            raise HTTPException(status_code=403, detail="Only company_admin can change roles")
        if user_has_any_role(target, UserRole.company_admin):
            raise HTTPException(status_code=400, detail="Cannot reassign company_admin role here")
        try:
            new_roles = validate_tenant_roles_non_empty([str(x) for x in body.roles])
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        if UserRole.company_admin.value in new_roles:
            raise HTTPException(status_code=400, detail="Cannot promote to company_admin via this endpoint")
        target.roles = new_roles
    elif "role" in data and data["role"]:
        if not user_has_any_role(actor, UserRole.company_admin):
            raise HTTPException(status_code=403, detail="Only company_admin can change roles")
        new_r = UserRole(data["role"])
        if user_has_any_role(target, UserRole.company_admin):
            raise HTTPException(status_code=400, detail="Cannot reassign company_admin role here")
        if new_r == UserRole.company_admin:
            raise HTTPException(status_code=400, detail="Cannot promote to company_admin via this endpoint")
        if new_r not in (UserRole.manager, UserRole.supervisor, UserRole.lead, UserRole.worker):
            raise HTTPException(status_code=400, detail="Invalid role")
        target.roles = [new_r.value]

    if "is_active" in data and data["is_active"] is not None:
        if user_has_any_role(actor, UserRole.manager, UserRole.supervisor) and not user_roles_subset_of(
            target,
            (UserRole.worker, UserRole.lead),
        ):
            raise HTTPException(status_code=403, detail="Not allowed")
        target.is_active = bool(data["is_active"])

    if "full_name" in data:
        target.full_name = data["full_name"]

    hr = await _get_hr(db, user_id)
    if not hr and any(
        k in data
        for k in (
            "phone",
            "department",
            "job_title",
            "shift",
            "supervisor_id",
            "start_date",
            "supervisor_notes",
        )
    ):
        hr = PulseWorkerHR(user_id=user_id, company_id=cid)
        db.add(hr)
        await db.flush()

    if hr:
        if "phone" in data:
            hr.phone = data["phone"]
        if "department" in data:
            hr.department = data["department"]
        if "job_title" in data:
            hr.job_title = data["job_title"]
        if "shift" in data:
            hr.shift = data["shift"]
        if "supervisor_id" in data:
            sid = data["supervisor_id"] or None
            await _assert_valid_supervisor(db, cid, sid)
            hr.supervisor_user_id = sid
        if "start_date" in data:
            hr.start_date = data["start_date"]
        if "supervisor_notes" in data:
            hr.supervisor_notes = data["supervisor_notes"]

    if "profile_notes" in data:
        prof = await _ensure_profile(db, cid, user_id)
        prof.notes = data["profile_notes"]

    if body.certifications is not None:
        await _sync_structured_certs(db, cid, user_id, body.certifications)
    if body.skills is not None:
        await _sync_skills(db, cid, user_id, body.skills)
    if body.training is not None:
        await _sync_training(db, cid, user_id, body.training)

    await db.commit()
    u2 = await pulse_svc._user_in_company(db, cid, user_id)
    assert u2
    users_map = await _users_by_company(db, cid)
    return await _build_detail(db, cid, u2, users_map)
