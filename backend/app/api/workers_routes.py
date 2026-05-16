"""
Workers & roles under `/api/workers`.

HR tables + company settings; multi-tenant with optional `company_id` for system administrators.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated, Any, Optional
from urllib.parse import quote
from uuid import uuid4

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.dialects.postgresql import array as pg_array
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.api.training_routes import build_worker_training_bundle
from app.core.user_roles import (
    default_operational_role_for_invite_role,
    primary_jwt_role,
    user_has_any_role,
    user_has_facility_tenant_admin_flag,
    user_has_tenant_full_admin,
    user_roles_subset_of,
    validate_tenant_roles_non_empty,
)
from app.core.company_features import tenant_enabled_feature_names_with_legacy
from app.core.config import get_settings
from app.core.login_activity import latest_login_event_per_user
from app.core.user_avatar_upload import co_worker_avatar_url
from app.core.features.service import MODULE_KEYS
from app.core.features.system_catalog import GLOBAL_SYSTEM_FEATURES
from app.core.rbac.audit_service import record_rbac_audit_event
from app.core.tenant_feature_access import (
    contract_and_effective_features_for_me,
    load_merged_workers_settings,
    user_has_workers_roster_page_access,
)
from app.core.tenant_roles import assign_user_tenant_role, get_tenant_role_in_company
from app.core.workers_permission_delegation import (
    actor_is_delegated_permission_editor,
    actor_may_set_worker_feature_allow_extra,
)
from app.core.workspace_departments import (
    normalize_workspace_department_slug,
    normalize_workspace_department_slug_list,
)
from app.core.matrix_slot_policy import (
    suggest_explicit_matrix_slot_for_department,
    worker_slot_audit_fields,
)
from app.core.permission_feature_matrix import (
    expand_department_role_matrix_baselines,
    permission_matrix_department_for_user,
)
from app.core.workers_settings_merge import (
    DEFAULT_WORKERS_SETTINGS,
    merge_workers_settings,
    sanitize_workers_policy_keys,
)
from app.core.email_smtp import send_employee_invite
from app.core.auth.security import bump_access_token_version, hash_password
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
from app.schemas.training import WorkerTrainingOut as WorkerTrainingBundleOut
from app.schemas.pulse_workers import (
    WorkerCertificationOut,
    WorkerComplianceSummaryOut,
    WorkerCreateIn,
    WorkerCreateResultOut,
    WorkerDetailOut,
    WorkerResendInviteIn,
    WorkerListOut,
    WorkerPatchIn,
    WorkerRowOut,
    ApplyDepartmentBaselinesOut,
    WorkerSlotAccessAuditOut,
    WorkerSlotAccessAuditRowOut,
    WorkersSettingsOut,
    WorkersSettingsPatchIn,
    WorkerSkillOut,
    WorkerTrainingOut,
    WorkerWorkSummaryOut,
)

router = APIRouter(prefix="/workers", tags=["workers"])


def _hr_department_slugs_list(hr: PulseWorkerHR | None) -> list[str]:
    if not hr:
        return []
    raw = getattr(hr, "department_slugs", None)
    if isinstance(raw, list):
        return normalize_workspace_department_slug_list([str(x) for x in raw])
    return []


def _merge_hr_department_slugs(body_department_slugs: list[str] | None, body_department: str | None) -> list[str]:
    slugs = normalize_workspace_department_slug_list(body_department_slugs)
    if slugs:
        return slugs
    one = normalize_workspace_department_slug((body_department or "").strip() or None)
    return [one] if one else []


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


async def require_workers_roster_page(
    user: Annotated[User, Depends(get_current_user)],
    db: Db,
    cid: CompanyId,
) -> User:
    if user_has_any_role(user, UserRole.system_admin) or user.is_system_admin:
        return user
    merged = await load_merged_workers_settings(db, cid)
    if user_has_workers_roster_page_access(user, merged):
        return user
    _, eff, _, _ = await contract_and_effective_features_for_me(db, user)
    if "team_management" in eff and user_has_any_role(
        user,
        UserRole.company_admin,
        UserRole.manager,
        UserRole.supervisor,
        UserRole.lead,
    ):
        return user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Team Management requires company admin access, delegation, or the team_management module for your role.",
    )


async def require_company_admin_for_workers_settings(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    if user_has_any_role(user, UserRole.system_admin) or user.is_system_admin:
        return user
    if not user_has_any_role(user, UserRole.company_admin) and not user_has_facility_tenant_admin_flag(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only company administrators can update workers settings.",
        )
    return user


RosterPageUser = Annotated[User, Depends(require_workers_roster_page)]
WorkersSettingsAdminUser = Annotated[User, Depends(require_company_admin_for_workers_settings)]


def _sanitize_feature_key_list(v: object) -> list[str]:
    cat = set(GLOBAL_SYSTEM_FEATURES)
    if not isinstance(v, list):
        return []
    return sorted({str(x) for x in v if str(x) in cat})


async def _contract_feature_names_for_company(db: AsyncSession, cid: str) -> list[str]:
    raw = await tenant_enabled_feature_names_with_legacy(db, cid)
    cat = set(GLOBAL_SYSTEM_FEATURES)
    return sorted({f for f in raw if f in MODULE_KEYS or f in cat})


_ROSTER_ROLES = (
    UserRole.company_admin,
    UserRole.manager,
    UserRole.supervisor,
    UserRole.lead,
    UserRole.worker,
    UserRole.demo_viewer,
)

_ROSTER_ROLE_VALUES = {r.value for r in _ROSTER_ROLES}


async def _roster_user_in_company_any_status(db: AsyncSession, cid: str, user_id: str) -> Optional[User]:
    """Resolve a tenant roster `User` by id, including inactive rows.

    `pulse_svc._user_in_company` only returns **active** users; the roster list defaults to
    `include_inactive=true`, so invited/deactivated rows could appear in the UI while DELETE
    incorrectly returned 404.
    """
    row = await db.execute(select(User).where(User.id == user_id, User.company_id == cid))
    u = row.scalar_one_or_none()
    if not u or not set(u.roles) & _ROSTER_ROLE_VALUES:
        return None
    return u


def _employee_join_path(raw_token: str) -> str:
    return f"/join?token={quote(raw_token, safe='')}"


def _pulse_public_link(path: str) -> str:
    base = get_settings().pulse_app_public_origin.rstrip("/")
    return f"{base}{path if path.startswith('/') else '/' + path}"


async def _assert_valid_tenant_role(db: AsyncSession, cid: str, tenant_role_id: Optional[str]) -> None:
    if not tenant_role_id:
        return
    role = await get_tenant_role_in_company(db, cid, tenant_role_id)
    if not role:
        raise HTTPException(status_code=400, detail="Invalid tenant role")


async def _assert_valid_supervisor(db: AsyncSession, cid: str, supervisor_id: Optional[str]) -> None:
    if not supervisor_id:
        return
    u = await pulse_svc._user_in_company(db, cid, supervisor_id)
    if not u:
        raise HTTPException(status_code=400, detail="Unknown supervisor")
    if u.account_status != UserAccountStatus.active or not u.is_active:
        raise HTTPException(status_code=400, detail="Supervisor must be an active user")
    if not user_has_any_role(u, UserRole.supervisor, UserRole.manager, UserRole.company_admin) and not user_has_facility_tenant_admin_flag(
        u
    ):
        raise HTTPException(
            status_code=400,
            detail="Supervisor must be a manager, supervisor, or company admin",
        )


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
            PulseWorkRequest.status.in_(
                (PulseWorkRequestStatus.open, PulseWorkRequestStatus.in_progress, PulseWorkRequestStatus.hold)
            ),
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


def _employment_type_from_scheduling_payload(scheduling: Any) -> Optional[str]:
    """Normalize scheduling.employment_type from PulseWorkerProfile.scheduling JSON."""
    if not isinstance(scheduling, dict):
        return None
    raw_et = scheduling.get("employment_type")
    emp_type = str(raw_et).strip() if raw_et is not None else ""
    return emp_type if emp_type in ("full_time", "regular_part_time", "part_time") else None


def _patch_actor_can_touch_target(actor: User, target: User) -> None:
    if user_has_any_role(actor, UserRole.system_admin) or actor.is_system_admin:
        return
    if user_has_any_role(actor, UserRole.company_admin) or user_has_facility_tenant_admin_flag(actor):
        return
    if user_has_any_role(actor, UserRole.manager, UserRole.supervisor):
        if not user_roles_subset_of(target, (UserRole.worker, UserRole.lead)):
            raise HTTPException(status_code=403, detail="Managers and supervisors may only edit workers or leads")
        return
    if user_has_any_role(actor, UserRole.lead):
        if not user_roles_subset_of(target, (UserRole.worker,)):
            raise HTTPException(status_code=403, detail="Leads may only edit workers")
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

    extras = list(u.feature_allow_extra) if isinstance(getattr(u, "feature_allow_extra", None), list) else []

    uid_s = str(u.id)
    sched = dict(p.scheduling or {}) if p else {}
    employment_type = _employment_type_from_scheduling_payload(sched)
    raw_rs = sched.get("recurring_shifts") or []
    if not isinstance(raw_rs, list):
        raw_rs = []
    recurring_shifts = [x for x in raw_rs if isinstance(x, dict)]
    gg_assignable = bool(sched.get("gg_assignable"))

    tr_id = getattr(u, "tenant_role_id", None)
    return WorkerDetailOut(
        id=uid_s,
        company_id=str(u.company_id) if u.company_id else cid,
        email=u.email,
        full_name=u.full_name,
        role=primary_jwt_role(u).value,
        roles=list(u.roles),
        tenant_role_id=str(tr_id) if tr_id else None,
        avatar_url=co_worker_avatar_url(uid_s, u.avatar_url),
        feature_allow_extra=[str(x) for x in extras if isinstance(x, str)],
        is_active=u.is_active,
        account_status=u.account_status.value,
        phone=hr.phone if hr else None,
        department=hr.department if hr else None,
        department_slugs=_hr_department_slugs_list(hr),
        job_title=hr.job_title if hr else None,
        matrix_slot=hr.matrix_slot if hr else None,
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
        employment_type=employment_type,
        recurring_shifts=recurring_shifts,
        gg_assignable=gg_assignable,
        compliance_summary=co,
        work_summary=wo,
        created_at=u.created_at,
    )


async def _get_settings_row(db: AsyncSession, cid: str) -> Optional[PulseWorkersSettings]:
    q = await db.execute(select(PulseWorkersSettings).where(PulseWorkersSettings.company_id == cid))
    return q.scalar_one_or_none()


@router.get("/settings", response_model=WorkersSettingsOut)
async def get_workers_settings(db: Db, _: RosterPageUser, cid: CompanyId) -> WorkersSettingsOut:
    row = await _get_settings_row(db, cid)
    cfn = await _contract_feature_names_for_company(db, cid)
    return WorkersSettingsOut(
        settings=merge_workers_settings(row.settings if row else None),
        contract_feature_names=cfn,
    )


def _apply_full_settings_patch(base: dict[str, Any], incoming: dict[str, Any]) -> None:
    for k, v in incoming.items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            m = dict(base[k])
            m.update(v)
            base[k] = m
        else:
            base[k] = v


def _apply_delegated_settings_patch(actor: User, base: dict[str, Any], incoming: dict[str, Any], contract: set[str]) -> None:
    """Merge only subordinate `role_feature_access` rows the actor is allowed to edit."""
    if not actor_is_delegated_permission_editor(actor, base):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission delegation is not enabled for your role.",
        )
    allowed_targets = delegated_role_feature_targets(actor, base)
    for key in incoming:
        if key != "role_feature_access":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Delegated editors may only update role module access (role_feature_access).",
            )
    rfa_in = incoming.get("role_feature_access")
    if not isinstance(rfa_in, dict):
        raise HTTPException(status_code=400, detail="role_feature_access must be an object")
    cur = dict(base.get("role_feature_access") or {})
    for rk, modules in rfa_in.items():
        role_key = str(rk)
        if role_key not in allowed_targets:
            continue
        cleaned = _sanitize_feature_key_list(modules)
        cur[role_key] = sorted(x for x in cleaned if x in contract)
    base["role_feature_access"] = cur


@router.patch("/settings", response_model=WorkersSettingsOut)
async def patch_workers_settings(
    db: Db,
    actor: Annotated[User, Depends(get_current_user)],
    cid: CompanyId,
    body: WorkersSettingsPatchIn,
) -> WorkersSettingsOut:
    await require_workers_roster_page(actor, db, cid)
    row = await _get_settings_row(db, cid)
    base = merge_workers_settings(row.settings if row else None)
    cfn_list = await _contract_feature_names_for_company(db, cid)
    contract_set = set(cfn_list)

    full_admin = (
        user_has_tenant_full_admin(actor)
        or user_has_any_role(actor, UserRole.system_admin)
        or actor.is_system_admin
    )
    if full_admin:
        _apply_full_settings_patch(base, body.settings)
    elif body.settings and actor_is_delegated_permission_editor(actor, base):
        _apply_delegated_settings_patch(actor, base, body.settings, contract_set)
    elif body.settings:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only company administrators or delegated operational roles may update these settings.",
        )

    sanitize_workers_policy_keys(base)
    if row:
        row.settings = base
    else:
        db.add(PulseWorkersSettings(id=str(uuid4()), company_id=cid, settings=base))
    await db.commit()
    cfn = await _contract_feature_names_for_company(db, cid)
    return WorkersSettingsOut(settings=base, contract_feature_names=cfn)


@router.get("/slot-access-audit", response_model=WorkerSlotAccessAuditOut)
async def worker_slot_access_audit(
    db: Db,
    _: RosterPageUser,
    cid: CompanyId,
) -> WorkerSlotAccessAuditOut:
    """Workers using inferred/fallback matrix slots — for Team Management cleanup."""
    roster_vals = [r.value for r in _ROSTER_ROLES]
    users = list(
        (
            await db.execute(
                select(User).where(
                    User.company_id == cid,
                    User.roles.overlap(pg_array(roster_vals)),
                    User.is_active.is_(True),
                )
            )
        ).scalars().all()
    )
    hr_map: dict[str, PulseWorkerHR] = {}
    if users:
        hq = await db.execute(select(PulseWorkerHR).where(PulseWorkerHR.user_id.in_([u.id for u in users])))
        for h in hq.scalars().all():
            hr_map[h.user_id] = h
    rows: list[WorkerSlotAccessAuditRowOut] = []
    inferred_count = 0
    unresolved_count = 0
    for u in users:
        h = hr_map.get(u.id)
        dept = permission_matrix_department_for_user(u, h)
        audit = worker_slot_audit_fields(u, h, department=dept)
        if not audit["matrix_slot_inferred"] and not audit.get("is_unresolved"):
            continue
        inferred_count += 1
        if audit.get("is_unresolved"):
            unresolved_count += 1
        rows.append(
            WorkerSlotAccessAuditRowOut(
                id=str(u.id),
                email=u.email,
                full_name=u.full_name,
                department=h.department if h else None,
                job_title=h.job_title if h else None,
                hr_matrix_slot=audit["hr_matrix_slot"],
                resolved_matrix_slot=audit["resolved_matrix_slot"],
                matrix_slot_source=audit["matrix_slot_source"],
                matrix_slot_display=audit["matrix_slot_display"],
                matrix_slot_source_label=audit.get("matrix_slot_source_label") or "",
                is_unresolved=bool(audit.get("is_unresolved")),
            )
        )
    rows.sort(key=lambda r: (not r.is_unresolved, (r.full_name or r.email or "").lower()))
    return WorkerSlotAccessAuditOut(
        items=rows,
        inferred_count=inferred_count,
        unresolved_count=unresolved_count,
    )


@router.post("/apply-department-baselines", response_model=ApplyDepartmentBaselinesOut)
async def apply_department_baselines(
    db: Db,
    actor: Annotated[User, Depends(get_current_user)],
    cid: CompanyId,
) -> ApplyDepartmentBaselinesOut:
    """Bulk-set explicit HR matrix_slot to each worker's department baseline (skips existing explicit slots)."""
    await require_workers_roster_page(actor, db, cid)
    roster_vals = [r.value for r in _ROSTER_ROLES]
    users = list(
        (
            await db.execute(
                select(User).where(
                    User.company_id == cid,
                    User.roles.overlap(pg_array(roster_vals)),
                    User.is_active.is_(True),
                )
            )
        ).scalars().all()
    )
    hr_map: dict[str, PulseWorkerHR] = {}
    if users:
        hq = await db.execute(select(PulseWorkerHR).where(PulseWorkerHR.user_id.in_([u.id for u in users])))
        for h in hq.scalars().all():
            hr_map[h.user_id] = h

    updated = 0
    skipped_explicit = 0
    skipped_no_hr = 0
    by_department: dict[str, int] = {}

    for u in users:
        h = hr_map.get(u.id)
        if not h:
            skipped_no_hr += 1
            continue
        if h.matrix_slot and str(h.matrix_slot).strip():
            skipped_explicit += 1
            continue
        dept = permission_matrix_department_for_user(u, h)
        baseline = suggest_explicit_matrix_slot_for_department(dept)
        if not baseline:
            continue
        h.matrix_slot = baseline
        updated += 1
        by_department[dept] = by_department.get(dept, 0) + 1

    if updated:
        await db.commit()

    return ApplyDepartmentBaselinesOut(
        updated_count=updated,
        skipped_explicit=skipped_explicit,
        skipped_no_hr=skipped_no_hr,
        by_department=by_department,
    )


@router.get("", response_model=WorkerListOut)
async def list_workers(
    db: Db,
    _: RosterPageUser,
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
    login_latest = await latest_login_event_per_user(db, [u.id for u in users])
    prof_map: dict[str, PulseWorkerProfile] = {}
    if users:
        uid_list = [u.id for u in users]
        pq = await db.execute(
            select(PulseWorkerProfile).where(
                PulseWorkerProfile.company_id == cid,
                PulseWorkerProfile.user_id.in_(uid_list),
            )
        )
        for pr in pq.scalars().all():
            prof_map[str(pr.user_id)] = pr
    items: list[WorkerRowOut] = []
    for u in users:
        h = hr_map.get(u.id)
        uid_s = str(u.id)
        le = login_latest.get(uid_s)
        prof_row = prof_map.get(uid_s)
        sched_row: dict[str, Any] | None = dict(prof_row.scheduling or {}) if prof_row else None
        employment_type = _employment_type_from_scheduling_payload(sched_row)
        gg_assignable = bool((sched_row or {}).get("gg_assignable"))
        dept_resolved = permission_matrix_department_for_user(u, h)
        slot_audit = worker_slot_audit_fields(u, h, department=dept_resolved)
        items.append(
            WorkerRowOut(
                id=uid_s,
                email=u.email,
                full_name=u.full_name,
                role=primary_jwt_role(u).value,
                roles=list(u.roles),
                tenant_role_id=str(u.tenant_role_id) if getattr(u, "tenant_role_id", None) else None,
                is_active=u.is_active,
                account_status=u.account_status.value,
                phone=h.phone if h else None,
                department=h.department if h else None,
                department_slugs=_hr_department_slugs_list(h),
                job_title=h.job_title if h else None,
                matrix_slot=h.matrix_slot if h else None,
                shift=h.shift if h else None,
                gg_assignable=gg_assignable,
                employment_type=employment_type,
                avatar_url=co_worker_avatar_url(uid_s, u.avatar_url),
                last_active_at=u.last_active_at,
                last_login_city=le.city if le else None,
                last_login_region=le.region if le else None,
                last_login_user_agent=le.user_agent if le else None,
                resolved_matrix_slot=slot_audit["resolved_matrix_slot"],
                matrix_slot_source=slot_audit["matrix_slot_source"],
                matrix_slot_source_kind=slot_audit["matrix_slot_source_kind"],
                matrix_slot_inferred=slot_audit["matrix_slot_inferred"],
                matrix_slot_display=slot_audit["matrix_slot_display"],
                matrix_slot_operational_label=slot_audit.get("matrix_slot_operational_label"),
                matrix_slot_source_label=slot_audit.get("matrix_slot_source_label"),
                is_unresolved=bool(slot_audit.get("is_unresolved")),
            )
        )
    return WorkerListOut(items=items)


@router.get("/{user_id}/training", response_model=WorkerTrainingBundleOut)
async def worker_training_matrix(
    db: Db,
    user: Annotated[User, Depends(get_current_user)],
    cid: CompanyId,
    user_id: str,
) -> WorkerTrainingBundleOut:
    if str(user.id) != user_id:
        await require_workers_roster_page(user, db, cid)
    else:
        u = await pulse_svc._user_in_company(db, cid, user_id)
        if not u:
            raise HTTPException(status_code=404, detail="User not found")
    return await build_worker_training_bundle(db, cid, user_id)


@router.get("/{user_id}/compliance-summary", response_model=WorkerComplianceSummaryOut)
async def worker_compliance_summary(db: Db, _: RosterPageUser, cid: CompanyId, user_id: str) -> WorkerComplianceSummaryOut:
    u = await pulse_svc._user_in_company(db, cid, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    return await _compliance_summary(db, cid, user_id, datetime.now(timezone.utc))


@router.get("/{user_id}/work-summary", response_model=WorkerWorkSummaryOut)
async def worker_work_summary(db: Db, _: RosterPageUser, cid: CompanyId, user_id: str) -> WorkerWorkSummaryOut:
    u = await pulse_svc._user_in_company(db, cid, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    return await _work_summary(db, cid, user_id, datetime.now(timezone.utc))


@router.get("/{user_id}", response_model=WorkerDetailOut)
async def get_worker(db: Db, _: RosterPageUser, cid: CompanyId, user_id: str) -> WorkerDetailOut:
    u = await pulse_svc._user_in_company(db, cid, user_id)
    roster_set = {r.value for r in _ROSTER_ROLES}
    if not u or not set(u.roles) & roster_set:
        raise HTTPException(status_code=404, detail="User not found")
    users_map = await _users_by_company(db, cid)
    return await _build_detail(db, cid, u, users_map)


def _company_admin_creatable_roles() -> frozenset[str]:
    return frozenset({"worker", "lead", "supervisor", "manager", "demo_viewer"})


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
    merged_slugs = _merge_hr_department_slugs(
        list(body.department_slugs) if body.department_slugs else None,
        body.department,
    )
    primary_department: str | None
    if merged_slugs:
        primary_department = merged_slugs[0]
    elif body.department and str(body.department).strip():
        primary_department = str(body.department).strip()
    else:
        primary_department = None

    if hr_row:
        hr_row.phone = body.phone
        hr_row.department = primary_department
        hr_row.department_slugs = merged_slugs if merged_slugs else None
        hr_row.job_title = body.job_title
        hr_row.matrix_slot = body.matrix_slot
        hr_row.shift = body.shift
        hr_row.supervisor_user_id = body.supervisor_id
        hr_row.start_date = body.start_date
    else:
        db.add(
            PulseWorkerHR(
                user_id=user.id,
                company_id=cid,
                phone=body.phone,
                department=primary_department,
                department_slugs=merged_slugs if merged_slugs else None,
                job_title=body.job_title,
                matrix_slot=body.matrix_slot,
                shift=body.shift,
                supervisor_user_id=body.supervisor_id,
                start_date=body.start_date,
            )
        )
    prof = await _ensure_profile(db, cid, user.id)
    if body.employment_type is not None:
        cur = dict(prof.scheduling or {})
        if body.employment_type:
            cur["employment_type"] = body.employment_type
        else:
            cur.pop("employment_type", None)
        prof.scheduling = cur
    await db.flush()
    if body.certifications:
        await _sync_structured_certs(db, cid, user.id, body.certifications)
    if body.skills:
        await _sync_skills(db, cid, user.id, body.skills)
    if body.training:
        await _sync_training(db, cid, user.id, body.training)
    if body.tenant_role_id is not None:
        role = await get_tenant_role_in_company(db, cid, body.tenant_role_id)
        if not role:
            raise HTTPException(status_code=400, detail="Invalid tenant role")
        await assign_user_tenant_role(db, user, role)


@router.post("", response_model=WorkerCreateResultOut, status_code=status.HTTP_201_CREATED)
async def create_worker(
    db: Db,
    actor: RosterPageUser,
    cid: CompanyId,
    body: WorkerCreateIn,
) -> WorkerCreateResultOut:
    if user_has_any_role(actor, UserRole.system_admin) or actor.is_system_admin:
        pass
    elif user_has_any_role(actor, UserRole.company_admin) or user_has_facility_tenant_admin_flag(actor):
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
    elif user_has_any_role(actor, UserRole.lead):
        if body.role != "worker":
            raise HTTPException(status_code=403, detail="Leads may only invite workers")
    else:
        raise HTTPException(status_code=403, detail="Not allowed to create users")

    email_norm = body.email.strip().lower()
    await _assert_valid_supervisor(db, cid, body.supervisor_id)

    role_enum = UserRole(body.role)
    settings = get_settings()

    if body.roster_profile_only:
        # "Roster-only" adds an active account without invite/join flow.
        # Use a temporary password so the user can sign in, then prompt them to change it.
        temp_pw = "Panorama"
        if not user_has_any_role(actor, UserRole.company_admin) and not user_has_facility_tenant_admin_flag(actor):
            raise HTTPException(
                status_code=403,
                detail="Only company administrators can create roster-only profiles",
            )

        existing_q = await db.execute(select(User).where(func.lower(User.email) == email_norm))
        existing = existing_q.scalar_one_or_none()

        if existing:
            if str(existing.company_id) != cid:
                raise HTTPException(status_code=400, detail="Email already in use")
            if existing.hashed_password:
                raise HTTPException(status_code=400, detail="Email already in use")
            user = existing
            user.roles = [role_enum.value]
            user.operational_role = default_operational_role_for_invite_role(role_enum)
            user.full_name = body.full_name
            user.account_status = UserAccountStatus.active
            user.invite_token_hash = None
            user.invite_expires_at = None
            user.hashed_password = hash_password(temp_pw)
            bump_access_token_version(user)
            user.is_active = True
            user.created_by = actor.id
        else:
            user = User(
                company_id=cid,
                email=email_norm,
                hashed_password=hash_password(temp_pw),
                full_name=body.full_name,
                roles=[role_enum.value],
                operational_role=default_operational_role_for_invite_role(role_enum),
                created_by=actor.id,
                account_status=UserAccountStatus.active,
                invite_token_hash=None,
                invite_expires_at=None,
                is_active=True,
            )
            db.add(user)
        await db.flush()

        hr = await _get_hr(db, user.id)
        await _apply_worker_hr_and_extras(db, cid, user, body, hr_row=hr)

        await db.commit()

        u2 = await pulse_svc._user_in_company(db, cid, user.id)
        assert u2
        users_map = await _users_by_company(db, cid)
        detail = await _build_detail(db, cid, u2, users_map)

        return WorkerCreateResultOut(
            worker=detail,
            invite_link_path="",
            invite_email_sent=None,
            message="Profile created — user is active on the roster. Temporary password set; prompt them to change it after sign-in.",
        )

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
        user.operational_role = default_operational_role_for_invite_role(role_enum)
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
            operational_role=default_operational_role_for_invite_role(role_enum),
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

    send_email = body.send_email
    invite_email_sent: bool | None
    if send_email and settings.smtp_configured:
        invite_email_sent = await send_employee_invite(
            settings,
            to_email=email_norm,
            company_name=co_name,
            invite_url=invite_url,
        )
    elif not send_email:
        invite_email_sent = None
    else:
        invite_email_sent = False

    await db.commit()

    u2 = await pulse_svc._user_in_company(db, cid, user.id)
    assert u2
    users_map = await _users_by_company(db, cid)
    detail = await _build_detail(db, cid, u2, users_map)

    if send_email:
        if invite_email_sent:
            create_msg = "Invite sent"
        elif settings.smtp_configured:
            create_msg = "Worker saved — email failed to send; share the activation link"
        else:
            create_msg = "Worker saved — SMTP not configured; share the activation link"
    else:
        create_msg = "Join link ready — share manually (no invite email sent for this action)"

    return WorkerCreateResultOut(
        worker=detail,
        invite_link_path=link_path,
        invite_email_sent=invite_email_sent,
        message=create_msg,
    )


@router.post("/{user_id}/resend-invite", status_code=status.HTTP_200_OK)
async def resend_worker_invite(
    db: Db,
    actor: RosterPageUser,
    cid: CompanyId,
    user_id: str,
    body: WorkerResendInviteIn | None = Body(default=None),
) -> dict[str, Any]:
    target = await _roster_user_in_company_any_status(db, cid, user_id)
    if not target:
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
    send_email = True if body is None else body.send_email
    invite_email_sent: bool | None = False
    if send_email and settings.smtp_configured:
        invite_email_sent = await send_employee_invite(
            settings,
            to_email=target.email,
            company_name=co_name,
            invite_url=invite_url,
        )
    elif not send_email:
        invite_email_sent = None

    if not send_email:
        resend_msg = "Join link ready — share manually (no invite email sent for this action)"
    elif invite_email_sent:
        resend_msg = "Invite resent"
    elif settings.smtp_configured:
        resend_msg = "Token updated — email failed to send; share the activation link"
    else:
        resend_msg = "Token updated — SMTP not configured; share the activation link"

    return {
        "invite_link_path": link_path,
        "invite_email_sent": invite_email_sent,
        "message": resend_msg,
    }


@router.patch("/{user_id}", response_model=WorkerDetailOut)
async def patch_worker(
    db: Db,
    actor: RosterPageUser,
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

    if "email" in data and data["email"] is not None:
        if not user_has_any_role(actor, UserRole.company_admin) and not user_has_facility_tenant_admin_flag(actor):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only company administrators can change sign-in email",
            )
        new_email = str(data["email"]).strip().lower()
        if new_email != (target.email or "").strip().lower():
            existing_q = await db.execute(select(User).where(func.lower(User.email) == new_email))
            other = existing_q.scalar_one_or_none()
            if other and str(other.id) != str(target.id):
                raise HTTPException(status_code=400, detail="Email already in use")
            target.email = new_email

    if body.roles is not None:
        if not user_has_any_role(actor, UserRole.company_admin) and not user_has_facility_tenant_admin_flag(actor):
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
        if not user_has_any_role(actor, UserRole.company_admin) and not user_has_facility_tenant_admin_flag(actor):
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
            "department_slugs",
            "job_title",
            "matrix_slot",
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
        if "department_slugs" in data:
            raw_ds = data["department_slugs"]
            if raw_ds is None:
                hr.department_slugs = None
            else:
                hr.department_slugs = normalize_workspace_department_slug_list(list(raw_ds))
            merged = _hr_department_slugs_list(hr)
            if merged:
                hr.department = merged[0]
            else:
                hr.department = None
                hr.department_slugs = None
        elif "department" in data:
            hr.department = data["department"]
            one = normalize_workspace_department_slug(
                str(data["department"]).strip() if data["department"] is not None else None
            )
            if one:
                hr.department_slugs = [one]
            elif data["department"] is None or (isinstance(data["department"], str) and not str(data["department"]).strip()):
                hr.department_slugs = None
        if "job_title" in data:
            hr.job_title = data["job_title"]
        if "matrix_slot" in data:
            hr.matrix_slot = data["matrix_slot"]
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

    if "employment_type" in data or "recurring_shifts" in data or "gg_assignable" in data:
        prof = await _ensure_profile(db, cid, user_id)
        cur = dict(prof.scheduling or {})
        if "employment_type" in data:
            et = data["employment_type"]
            if et:
                cur["employment_type"] = et
            else:
                cur.pop("employment_type", None)
        if "recurring_shifts" in data:
            rs = data["recurring_shifts"]
            if rs is None:
                cur.pop("recurring_shifts", None)
            else:
                cleaned: list[dict[str, Any]] = []
                for item in rs:
                    if not isinstance(item, dict):
                        continue
                    dow = item.get("day_of_week") or item.get("dayOfWeek")
                    start = item.get("start")
                    end = item.get("end")
                    if dow is None or start is None or end is None:
                        continue
                    row: dict[str, Any] = {
                        "day_of_week": str(dow).strip().lower(),
                        "start": str(start).strip(),
                        "end": str(end).strip(),
                    }
                    role_v = item.get("role")
                    if role_v is not None and str(role_v).strip():
                        row["role"] = str(role_v).strip()
                    rc = item.get("required_certifications")
                    if isinstance(rc, list) and rc:
                        row["required_certifications"] = [str(x) for x in rc if x is not None and str(x).strip()]
                    cleaned.append(row)
                if cleaned:
                    cur["recurring_shifts"] = cleaned
                else:
                    cur.pop("recurring_shifts", None)
        if "gg_assignable" in data:
            ga = data["gg_assignable"]
            if ga is True:
                cur["gg_assignable"] = True
            else:
                cur.pop("gg_assignable", None)
        prof.scheduling = cur

    if body.certifications is not None:
        await _sync_structured_certs(db, cid, user_id, body.certifications)
    if body.skills is not None:
        await _sync_skills(db, cid, user_id, body.skills)
    if body.training is not None:
        await _sync_training(db, cid, user_id, body.training)

    if "tenant_role_id" in data:
        if not user_has_any_role(actor, UserRole.company_admin) and not user_has_facility_tenant_admin_flag(actor):
            raise HTTPException(status_code=403, detail="Only company administrators can assign tenant roles")
        tr_val = data["tenant_role_id"]
        if tr_val is None:
            target.tenant_role_id = None
        else:
            role = await get_tenant_role_in_company(db, cid, str(tr_val))
            if not role:
                raise HTTPException(status_code=400, detail="Invalid tenant role")
            await assign_user_tenant_role(db, target, role)
        await record_rbac_audit_event(
            db,
            company_id=cid,
            actor_user_id=str(actor.id),
            action="user.tenant_role.updated",
            target_user_id=str(target.id),
            payload={"tenant_role_id": target.tenant_role_id},
        )

    if body.feature_allow_extra is not None:
        merged = await load_merged_workers_settings(db, cid)
        if not actor_may_set_worker_feature_allow_extra(actor, target, merged):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only company administrators or delegated leads may set extra module access for worker-role users when enabled in Team Management settings.",
            )
        raw_ex = getattr(target, "feature_allow_extra", None)
        before_extras = list(raw_ex) if isinstance(raw_ex, list) else []
        target.feature_allow_extra = _sanitize_feature_key_list(body.feature_allow_extra)
        await record_rbac_audit_event(
            db,
            company_id=cid,
            actor_user_id=str(actor.id),
            action="user.feature_allow_extra.updated",
            target_user_id=str(target.id),
            payload={"before": before_extras, "after": list(target.feature_allow_extra)},
        )

    await db.commit()
    u2 = await pulse_svc._user_in_company(db, cid, user_id)
    assert u2
    users_map = await _users_by_company(db, cid)
    return await _build_detail(db, cid, u2, users_map)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_worker(
    db: Db,
    actor: WorkersSettingsAdminUser,
    cid: CompanyId,
    user_id: str,
) -> None:
    """Permanently remove a tenant roster user. Company administrators (and system administrators) only."""
    if str(actor.id) == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    target = await _roster_user_in_company_any_status(db, cid, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if user_has_any_role(target, UserRole.company_admin):
        raise HTTPException(
            status_code=400,
            detail="Cannot delete a company administrator. Demote them first or contact support.",
        )

    company = await db.get(Company, cid)
    if company and company.owner_admin_id and str(company.owner_admin_id) == user_id:
        raise HTTPException(
            status_code=400,
            detail="This user is the organization owner record. Reassign the owner before deleting this account.",
        )

    await db.execute(delete(User).where(User.id == user_id))
    await db.commit()
