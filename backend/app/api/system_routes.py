"""Internal system administration (/api/system/*) — companies, invites, users, audit."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import array as pg_array
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import require_system_admin
from app.core.user_roles import (
    default_operational_role_for_invite_role,
    primary_jwt_role,
    user_has_any_role,
    validate_tenant_roles_non_empty,
)
from app.core.audit.service import record_audit
from app.core.auth.security import create_access_token, hash_password as hash_pw
from app.core.config import Settings, get_settings
from app.core.database import get_db
from app.core.email_smtp import send_company_admin_invite, send_password_reset_email
from app.core.company_features import list_enabled_names, sync_enabled_features
from app.core.features.cache import invalidate
from app.core.features.service import MODULE_KEYS
from app.core.features.system_catalog import (
    GLOBAL_SYSTEM_FEATURES,
    canonicalize_enabled_features_for_admin_ui,
    expand_feature_name_for_usage_counts,
    normalize_enabled_features,
)
from app.core.company_logo_upload import INTERNAL_LOGO_PATH, normalize_logo_content_type, validate_logo_bytes
from app.core.login_activity import latest_login_event_per_user, list_recent_login_events
from app.core.pulse_storage import write_company_logo_bytes
from app.core.system_audit import record_system_log
from app.core.system_tokens import generate_raw_token, hash_system_token as hash_opaque_token
from app.models.domain import (
    Company,
    CompanyFeature,
    Invite,
    SystemLog,
    SystemSecureToken,
    SystemSecureTokenKind,
    User,
    UserRole,
)
from app.schemas.auth import Token
from app.schemas.login_events import LoginEventOut
from app.schemas.system_admin import (
    SystemCompanyBootstrapPassword,
    SystemCompanyCreate,
    SystemCompanyCreateAndInvite,
    SystemCompanyMemberOut,
    SystemCompanyPatch,
    SystemCompanyRow,
    SystemInviteCreate,
    SystemLogRow,
    SystemOverviewOut,
    SystemPendingInviteRow,
    SystemUserRow,
    SystemUsersDirectoryOut,
    TransferTenantOwnerBody,
    TransferTenantOwnerOut,
)


class SystemUserPmFeaturesPatch(BaseModel):
    can_use_pm_features: bool


class SystemUserFacilityAdminPatch(BaseModel):
    facility_tenant_admin: bool

# Mounted in main.py at prefix `/api/system` — do not add another `/system` here or routes become `/api/system/system/...`.
router = APIRouter(tags=["system"])
settings = get_settings()
_log = logging.getLogger(__name__)


def _invite_path(raw_token: str) -> str:
    from urllib.parse import quote

    return f"/invite?token={quote(raw_token, safe='')}"


def _reset_path(raw_token: str) -> str:
    from urllib.parse import quote

    return f"/reset-password?token={quote(raw_token, safe='')}"


def _pulse_app_link(path: str) -> str:
    base = settings.pulse_app_public_origin
    return f"{base}{path if path.startswith('/') else '/' + path}"


@router.get("/overview", response_model=SystemOverviewOut)
async def system_overview(
    _: Annotated[User, Depends(require_system_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SystemOverviewOut:
    active_cos = int(
        (await db.execute(select(func.count()).select_from(Company).where(Company.is_active.is_(True)))).scalar_one()
        or 0
    )
    all_cos = int((await db.execute(select(func.count()).select_from(Company))).scalar_one() or 0)
    total_users = int((await db.execute(select(func.count()).select_from(User))).scalar_one() or 0)

    feature_usage: dict[str, int] = {f: 0 for f in GLOBAL_SYSTEM_FEATURES}
    fq = await db.execute(
        select(CompanyFeature.feature_name, func.count())
        .join(Company, Company.id == CompanyFeature.company_id)
        .where(Company.is_active.is_(True), CompanyFeature.enabled.is_(True))
        .group_by(CompanyFeature.feature_name)
    )
    for fname, cnt in fq.all():
        for key in expand_feature_name_for_usage_counts(fname):
            if key in feature_usage:
                feature_usage[key] += int(cnt)

    return SystemOverviewOut(
        total_companies=all_cos,
        active_companies=active_cos,
        total_users=total_users,
        feature_usage=feature_usage,
    )


@router.get("/features/catalog")
async def feature_catalog(_: Annotated[User, Depends(require_system_admin)]) -> dict[str, list[str]]:
    return {"features": list(GLOBAL_SYSTEM_FEATURES), "legacy_module_keys": list(MODULE_KEYS)}


@router.post("/companies", status_code=status.HTTP_201_CREATED)
async def create_company(
    body: SystemCompanyCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_system_admin)],
) -> dict[str, str]:
    feats = normalize_enabled_features(body.enabled_features)
    company = Company(name=body.name.strip(), owner_admin_id=None, is_active=True)
    db.add(company)
    await db.flush()
    await sync_enabled_features(db, company.id, feats)
    await record_system_log(
        db,
        action="company.created",
        performed_by=admin.id,
        target_type="company",
        target_id=company.id,
        metadata={"name": company.name},
    )
    await db.commit()
    return {"id": company.id}


@router.post("/companies/create-and-invite", status_code=status.HTTP_201_CREATED)
async def create_company_and_invite(
    body: SystemCompanyCreateAndInvite,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_system_admin)],
) -> dict[str, Any]:
    email_norm = body.admin_email.strip().lower()
    now = datetime.now(timezone.utc)
    reg = await db.execute(select(User.id).where(func.lower(User.email) == email_norm))
    if reg.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    pending_inv = await db.execute(
        select(Invite.id)
        .where(
            func.lower(Invite.email) == email_norm,
            Invite.used.is_(False),
            Invite.expires_at > now,
        )
        .limit(1)
    )
    if pending_inv.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "A pending invite already exists for this email. Open Companies, find the tenant with that "
                "invite, or purge an empty duplicate before trying again—retries were creating multiple tenants."
            ),
        )

    feats = normalize_enabled_features(body.enabled_features)
    company = Company(name=body.company_name.strip(), owner_admin_id=None, is_active=True)
    db.add(company)
    await db.flush()
    await sync_enabled_features(db, company.id, feats)

    raw = generate_raw_token()
    exp = datetime.now(timezone.utc) + timedelta(hours=settings.system_invite_expire_hours)
    db.add(
        Invite(
            email=body.admin_email,
            role=UserRole.company_admin.value,
            company_id=company.id,
            token_hash=hash_opaque_token(raw),
            expires_at=exp,
            created_by_user_id=admin.id,
        )
    )
    await record_system_log(
        db,
        action="company.created_with_invite",
        performed_by=admin.id,
        target_type="company",
        target_id=company.id,
        metadata={"admin_email": email_norm},
    )
    await db.commit()
    link_path = _invite_path(raw)
    invite_url = _pulse_app_link(link_path)

    cfg = get_settings()
    invite_email_sent = False
    if cfg.smtp_configured:
        invite_email_sent = await send_company_admin_invite(
            cfg,
            to_email=email_norm,
            company_name=company.name,
            invite_url=invite_url,
        )
    return {
        "company_id": company.id,
        "invite_link_path": link_path,
        "invite_email_sent": invite_email_sent,
        "invite_email_pending": False,
    }


@router.post("/companies/bootstrap-legacy", status_code=status.HTTP_201_CREATED)
async def bootstrap_company_with_password_admin(
    body: SystemCompanyBootstrapPassword,
    db: Annotated[AsyncSession, Depends(get_db)],
    system: Annotated[User, Depends(require_system_admin)],
) -> dict[str, str]:
    """Create company and first company_admin with password (no email invite)."""
    if not settings.allow_password_company_bootstrap:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Password company bootstrap is disabled. Set ALLOW_PASSWORD_COMPANY_BOOTSTRAP=true on the API.",
        )
    exists = await db.execute(select(User).where(User.email == body.admin_email))
    if exists.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already in use")

    feats = normalize_enabled_features(body.enabled_features)
    company = Company(name=body.company_name.strip(), owner_admin_id=None, is_active=True)
    db.add(company)
    await db.flush()
    await sync_enabled_features(db, company.id, feats)

    admin_user = User(
        company_id=company.id,
        email=body.admin_email,
        hashed_password=hash_pw(body.admin_password),
        full_name=body.admin_full_name,
        roles=[UserRole.company_admin.value],
        created_by=system.id,
    )
    db.add(admin_user)
    await db.flush()

    company.owner_admin_id = admin_user.id
    await db.flush()

    await record_audit(
        db,
        action="system.company_created",
        actor_user_id=system.id,
        company_id=company.id,
        metadata={
            "company_id": company.id,
            "company_admin_id": admin_user.id,
            "admin_email": body.admin_email,
        },
    )
    await record_system_log(
        db,
        action="company.bootstrap_password_admin",
        performed_by=system.id,
        target_type="company",
        target_id=company.id,
        metadata={"admin_email": body.admin_email, "target_user_id": admin_user.id},
    )
    await db.commit()
    return {"company_id": company.id, "company_admin_id": admin_user.id}


@router.get("/companies", response_model=list[SystemCompanyRow])
async def list_companies(
    _: Annotated[User, Depends(require_system_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
    include_inactive: bool = Query(default=False),
    q: Optional[str] = Query(None, description="Filter by name"),
) -> list[SystemCompanyRow]:
    stmt = select(Company).order_by(Company.name)
    if not include_inactive:
        stmt = stmt.where(Company.is_active.is_(True))
    if q:
        stmt = stmt.where(Company.name.ilike(f"%{q}%"))
    rows = (await db.execute(stmt)).scalars().all()
    out: list[SystemCompanyRow] = []
    for c in rows:
        uc = await db.execute(
            select(func.count())
            .select_from(User)
            .where(User.company_id == c.id, User.is_active.is_(True))
        )
        cnt = int(uc.scalar_one() or 0)
        ef = canonicalize_enabled_features_for_admin_ui(await list_enabled_names(db, c.id))
        out.append(
            SystemCompanyRow(
                id=c.id,
                name=c.name,
                logo_url=c.logo_url,
                header_image_url=c.header_image_url,
                enabled_features=ef,
                user_count=cnt,
                is_active=c.is_active,
                owner_admin_id=c.owner_admin_id,
            )
        )
    return out


async def _purge_empty_company_core(company_id: str, admin: User, db: AsyncSession) -> None:
    """Hard-delete a tenant that has no users. Use to remove mistaken duplicate shells (after deactivate)."""
    c = await db.get(Company, company_id)
    if not c:
        raise HTTPException(status_code=404, detail="Company not found")
    uc = int(
        (await db.execute(select(func.count()).select_from(User).where(User.company_id == company_id))).scalar_one()
        or 0
    )
    if uc > 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot permanently delete a company that has users. Remove users first or keep the tenant deactivated.",
        )
    name = c.name
    cid = c.id
    await record_system_log(
        db,
        action="company.purged",
        performed_by=admin.id,
        target_type="company",
        target_id=cid,
        metadata={"name": name},
    )
    await db.execute(delete(Company).where(Company.id == cid))
    await db.commit()


@router.post("/companies/{company_id}/purge", status_code=status.HTTP_204_NO_CONTENT)
async def purge_empty_company_post(
    company_id: str,
    admin: Annotated[User, Depends(require_system_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    await _purge_empty_company_core(company_id, admin, db)


@router.delete("/companies/{company_id}/purge", status_code=status.HTTP_204_NO_CONTENT)
async def purge_empty_company_delete(
    company_id: str,
    admin: Annotated[User, Depends(require_system_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    await _purge_empty_company_core(company_id, admin, db)


@router.post("/company-empty-delete/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
async def purge_empty_company_alt_post(
    company_id: str,
    admin: Annotated[User, Depends(require_system_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    await _purge_empty_company_core(company_id, admin, db)


@router.delete("/company-empty-delete/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
async def purge_empty_company_alt_delete(
    company_id: str,
    admin: Annotated[User, Depends(require_system_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    await _purge_empty_company_core(company_id, admin, db)


@router.post("/tenant-hard-remove/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
async def tenant_hard_remove_post(
    company_id: str,
    admin: Annotated[User, Depends(require_system_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Hard-delete empty tenant — distinct path from `/companies/.../purge` for simpler routing."""
    await _purge_empty_company_core(company_id, admin, db)


@router.delete("/tenant-hard-remove/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
async def tenant_hard_remove_delete(
    company_id: str,
    admin: Annotated[User, Depends(require_system_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    await _purge_empty_company_core(company_id, admin, db)


@router.get("/companies/{company_id}", response_model=SystemCompanyRow)
async def get_company(
    company_id: str,
    _: Annotated[User, Depends(require_system_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SystemCompanyRow:
    c = await db.get(Company, company_id)
    if not c:
        raise HTTPException(status_code=404, detail="Company not found")
    uc = await db.execute(
        select(func.count()).select_from(User).where(User.company_id == c.id, User.is_active.is_(True))
    )
    cnt = int(uc.scalar_one() or 0)
    ef = canonicalize_enabled_features_for_admin_ui(await list_enabled_names(db, c.id))
    return SystemCompanyRow(
        id=c.id,
        name=c.name,
        logo_url=c.logo_url,
        header_image_url=c.header_image_url,
        enabled_features=ef,
        user_count=cnt,
        is_active=c.is_active,
        owner_admin_id=c.owner_admin_id,
    )


@router.get("/companies/{company_id}/members", response_model=list[SystemCompanyMemberOut])
async def list_company_members(
    company_id: str,
    _: Annotated[User, Depends(require_system_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[SystemCompanyMemberOut]:
    c = await db.get(Company, company_id)
    if not c:
        raise HTTPException(status_code=404, detail="Company not found")
    q = await db.execute(select(User).where(User.company_id == company_id).order_by(User.email.asc()))
    users = list(q.scalars().all())
    return [
        SystemCompanyMemberOut(id=str(u.id), email=u.email, full_name=u.full_name, roles=list(u.roles or []))
        for u in users
    ]


@router.post(
    "/companies/{company_id}/transfer-tenant-owner",
    response_model=TransferTenantOwnerOut,
    status_code=status.HTTP_200_OK,
)
async def transfer_tenant_owner(
    company_id: str,
    body: TransferTenantOwnerBody,
    admin: Annotated[User, Depends(require_system_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TransferTenantOwnerOut:
    """
    Canonical tenant owner swap: updates `companies.owner_admin_id` and aligns RBAC so the
    system users directory reflects the same truth as downstream checks.
    """
    c = await db.get(Company, company_id)
    if not c:
        raise HTTPException(status_code=404, detail="Company not found")
    new_u = await db.get(User, body.new_owner_user_id)
    if not new_u or str(new_u.company_id) != str(company_id):
        raise HTTPException(status_code=400, detail="New owner must be an active user row in this company")
    if user_has_any_role(new_u, UserRole.system_admin) or new_u.is_system_admin:
        raise HTTPException(status_code=400, detail="Cannot assign platform system admin as tenant owner")
    prev_id = str(c.owner_admin_id) if c.owner_admin_id else None
    if prev_id == str(new_u.id):
        raise HTTPException(status_code=400, detail="User is already the recorded tenant owner")

    _prev_owner_role_map: dict[str, UserRole] = {
        UserRole.worker.value: UserRole.worker,
        UserRole.lead.value: UserRole.lead,
        UserRole.supervisor.value: UserRole.supervisor,
        UserRole.manager.value: UserRole.manager,
    }
    previous_role_enum = _prev_owner_role_map[body.change_previous_owner_to]

    if prev_id:
        prev = await db.get(User, prev_id)
        if prev and str(prev.company_id) == str(company_id):
            stripped = [r for r in (prev.roles or []) if r != UserRole.company_admin.value]
            if not stripped:
                stripped = [previous_role_enum.value]
            prev.roles = validate_tenant_roles_non_empty(stripped)
            prev.operational_role = default_operational_role_for_invite_role(previous_role_enum)

    new_u.roles = validate_tenant_roles_non_empty([UserRole.company_admin.value])
    new_u.operational_role = default_operational_role_for_invite_role(UserRole.company_admin)

    c.owner_admin_id = new_u.id
    await record_system_log(
        db,
        action="company.tenant_owner_transferred",
        performed_by=admin.id,
        target_type="company",
        target_id=c.id,
        metadata={
            "new_owner_user_id": str(new_u.id),
            "previous_owner_user_id": prev_id,
            "change_previous_owner_to": body.change_previous_owner_to,
        },
    )
    await db.commit()
    await db.refresh(c)
    return TransferTenantOwnerOut(company_id=str(c.id), owner_admin_id=str(new_u.id))


@router.patch("/companies/{company_id}", response_model=SystemCompanyRow)
async def patch_company(
    company_id: str,
    body: SystemCompanyPatch,
    admin: Annotated[User, Depends(require_system_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SystemCompanyRow:
    c = await db.get(Company, company_id)
    if not c:
        raise HTTPException(status_code=404, detail="Company not found")
    data = body.model_dump(exclude_unset=True)
    prev_feats = await list_enabled_names(db, c.id)
    if "enabled_features" in data:
        await sync_enabled_features(db, c.id, data["enabled_features"] or [])
        invalidate(company_id)
    if "is_active" in data:
        c.is_active = bool(data["is_active"])
    if "name" in data and data["name"]:
        c.name = data["name"].strip()
    if "logo_url" in data:
        raw = data["logo_url"]
        if raw is None:
            c.logo_url = None
        else:
            c.logo_url = str(raw).strip() or None
    if "header_image_url" in data:
        raw = data["header_image_url"]
        if raw is None:
            c.header_image_url = None
        else:
            c.header_image_url = str(raw).strip() or None
    await record_system_log(
        db,
        action="company.updated",
        performed_by=admin.id,
        target_type="company",
        target_id=c.id,
        metadata={"patch": data, "previous_features": prev_feats},
    )
    await db.commit()
    await db.refresh(c)
    uc = await db.execute(
        select(func.count()).select_from(User).where(User.company_id == c.id, User.is_active.is_(True))
    )
    cnt = int(uc.scalar_one() or 0)
    ef = canonicalize_enabled_features_for_admin_ui(await list_enabled_names(db, c.id))
    return SystemCompanyRow(
        id=c.id,
        name=c.name,
        logo_url=c.logo_url,
        header_image_url=c.header_image_url,
        enabled_features=ef,
        user_count=cnt,
        is_active=c.is_active,
        owner_admin_id=c.owner_admin_id,
    )


@router.post("/companies/{company_id}/logo", response_model=SystemCompanyRow)
async def upload_company_logo_as_system_admin(
    company_id: str,
    admin: Annotated[User, Depends(require_system_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
) -> SystemCompanyRow:
    """Store logo file for any tenant (same disk layout as POST /api/v1/company/logo)."""
    c = await db.get(Company, company_id)
    if not c:
        raise HTTPException(status_code=404, detail="Company not found")

    ct = normalize_logo_content_type(file.content_type)
    raw = await file.read()
    try:
        ext = validate_logo_bytes(ct, raw)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e

    try:
        await write_company_logo_bytes(company_id, ext, ct, raw)
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)) from e
    c.logo_url = INTERNAL_LOGO_PATH
    await record_system_log(
        db,
        action="company.logo_uploaded",
        performed_by=admin.id,
        target_type="company",
        target_id=c.id,
        metadata={},
    )
    await db.commit()
    await db.refresh(c)

    uc = await db.execute(
        select(func.count()).select_from(User).where(User.company_id == c.id, User.is_active.is_(True))
    )
    cnt = int(uc.scalar_one() or 0)
    ef = canonicalize_enabled_features_for_admin_ui(await list_enabled_names(db, c.id))
    return SystemCompanyRow(
        id=c.id,
        name=c.name,
        logo_url=c.logo_url,
        header_image_url=c.header_image_url,
        enabled_features=ef,
        user_count=cnt,
        is_active=c.is_active,
        owner_admin_id=c.owner_admin_id,
    )


@router.delete("/companies/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
async def soft_delete_company(
    company_id: str,
    admin: Annotated[User, Depends(require_system_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    c = await db.get(Company, company_id)
    if not c:
        raise HTTPException(status_code=404, detail="Company not found")
    c.is_active = False
    await record_system_log(
        db,
        action="company.soft_deleted",
        performed_by=admin.id,
        target_type="company",
        target_id=c.id,
        metadata={"name": c.name},
    )
    await db.commit()


@router.post("/invite", status_code=status.HTTP_201_CREATED)
async def create_invite(
    body: SystemInviteCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_system_admin)],
) -> dict[str, str]:
    c = await db.get(Company, body.company_id)
    if not c or not c.is_active:
        raise HTTPException(status_code=400, detail="Invalid or inactive company")
    exists = await db.execute(select(User).where(User.email == body.email))
    if exists.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    raw = generate_raw_token()
    exp = datetime.now(timezone.utc) + timedelta(hours=settings.system_invite_expire_hours)
    db.add(
        Invite(
            email=body.email,
            role=body.role,
            company_id=body.company_id,
            token_hash=hash_opaque_token(raw),
            expires_at=exp,
            created_by_user_id=admin.id,
        )
    )
    await record_system_log(
        db,
        action="invite.created",
        performed_by=admin.id,
        target_type="company",
        target_id=body.company_id,
        metadata={"email": body.email, "role": body.role},
    )
    await db.commit()
    link_path = _invite_path(raw)
    invite_url = _pulse_app_link(link_path)
    invite_email_sent = await send_company_admin_invite(
        settings,
        to_email=body.email,
        company_name=c.name,
        invite_url=invite_url,
    )
    return {"invite_link_path": link_path, "invite_email_sent": invite_email_sent}


@router.get("/users", response_model=SystemUsersDirectoryOut)
async def list_all_users(
    _: Annotated[User, Depends(require_system_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    q: Optional[str] = Query(None),
    role: Optional[str] = Query(None, description="Filter by role enum value, e.g. system_admin, company_admin"),
) -> SystemUsersDirectoryOut:
    stmt = select(User, Company).outerjoin(Company, User.company_id == Company.id)
    if role and role.strip():
        try:
            role_enum = UserRole(role.strip())
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid role filter",
            ) from e
        stmt = stmt.where(User.roles.overlap(pg_array([role_enum.value])))
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            (User.email.ilike(like))
            | (User.full_name.ilike(like))
            | (Company.name.ilike(like))
        )
    stmt = stmt.order_by(User.created_at.desc()).offset(offset).limit(limit)
    rows = (await db.execute(stmt)).all()
    login_latest = await latest_login_event_per_user(db, [u.id for u, _ in rows])
    out_users: list[SystemUserRow] = []
    for u, co in rows:
        company_name = co.name if co else None
        owner_id = str(co.owner_admin_id) if co and co.owner_admin_id else None
        is_owner = bool(owner_id and owner_id == str(u.id))
        le = login_latest.get(u.id)
        out_users.append(
            SystemUserRow(
                id=u.id,
                email=u.email,
                full_name=u.full_name,
                role=primary_jwt_role(u).value,
                roles=list(u.roles),
                company_id=u.company_id,
                company_name=company_name,
                is_company_owner=is_owner,
                is_active=u.is_active,
                can_use_pm_features=bool(getattr(u, "can_use_pm_features", False)),
                facility_tenant_admin=bool(getattr(u, "facility_tenant_admin", False)),
                last_login=u.last_login.isoformat() if u.last_login else None,
                last_active_at=u.last_active_at.isoformat() if u.last_active_at else None,
                last_login_city=le.city if le else None,
                last_login_region=le.region if le else None,
                last_login_user_agent=le.user_agent if le else None,
            )
        )

    now = datetime.now(timezone.utc)
    inv_stmt = (
        select(Invite, Company.name)
        .join(Company, Invite.company_id == Company.id)
        .where(Invite.used.is_(False), Invite.expires_at > now)
    )
    if q:
        like = f"%{q}%"
        inv_stmt = inv_stmt.where((Invite.email.ilike(like)) | (Company.name.ilike(like)))
    inv_stmt = inv_stmt.order_by(Invite.created_at.desc()).limit(limit)
    inv_rows = (await db.execute(inv_stmt)).all()
    out_inv: list[SystemPendingInviteRow] = []
    for inv, co_name in inv_rows:
        out_inv.append(
            SystemPendingInviteRow(
                invite_id=inv.id,
                email=inv.email,
                role=inv.role,
                company_id=inv.company_id,
                company_name=co_name,
                expires_at=inv.expires_at.isoformat(),
            )
        )

    return SystemUsersDirectoryOut(users=out_users, pending_invites=out_inv)


@router.patch("/users/{user_id}/pm-features", status_code=200)
async def patch_user_pm_features(
    user_id: str,
    body: SystemUserPmFeaturesPatch,
    admin: Annotated[User, Depends(require_system_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    u = await db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    u.can_use_pm_features = bool(body.can_use_pm_features)
    await record_system_log(
        db,
        action="user.pm_features_updated",
        performed_by=admin.id,
        target_type="user",
        target_id=u.id,
        metadata={"can_use_pm_features": u.can_use_pm_features},
    )
    await db.commit()
    return {"id": u.id, "can_use_pm_features": u.can_use_pm_features}


@router.patch("/users/{user_id}/facility-tenant-admin", status_code=200)
async def patch_user_facility_tenant_admin(
    user_id: str,
    body: SystemUserFacilityAdminPatch,
    admin: Annotated[User, Depends(require_system_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    """Grant or revoke in-facility tenant administrator (keeps base role; supersedes manager deny overlays in UI)."""
    u = await db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if u.company_id is None:
        raise HTTPException(status_code=400, detail="Facility tenant admin applies to tenant users only")
    u.facility_tenant_admin = bool(body.facility_tenant_admin)
    await record_system_log(
        db,
        action="user.facility_tenant_admin_updated",
        performed_by=admin.id,
        target_type="user",
        target_id=u.id,
        metadata={"facility_tenant_admin": u.facility_tenant_admin},
    )
    await db.commit()
    return {"id": u.id, "facility_tenant_admin": u.facility_tenant_admin}


@router.get("/users/{user_id}/login-events", response_model=list[LoginEventOut])
async def system_user_login_events(
    user_id: str,
    _: Annotated[User, Depends(require_system_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[LoginEventOut]:
    """Last 20 password logins for any user (system_admin)."""
    u = await db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    rows = await list_recent_login_events(db, user_id, limit=20)
    return [LoginEventOut.model_validate(r) for r in rows]


@router.post("/users/{user_id}/impersonate", response_model=Token)
async def system_impersonate_user(
    user_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_system_admin)],
) -> Token:
    if admin.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot impersonate yourself")
    q = await db.execute(select(User).where(User.id == user_id))
    target = q.scalar_one_or_none()
    if not target or not target.is_active:
        raise HTTPException(status_code=404, detail="User not found")
    if user_has_any_role(target, UserRole.system_admin):
        raise HTTPException(status_code=400, detail="Cannot impersonate system_admin")

    await record_audit(
        db,
        action="auth.impersonation.start",
        actor_user_id=admin.id,
        company_id=target.company_id,
        metadata={
            "target_user_id": target.id,
            "target_email": target.email,
            "impersonator_id": admin.id,
        },
    )
    await record_system_log(
        db,
        action="user.impersonation",
        performed_by=admin.id,
        target_type="user",
        target_id=target.id,
        metadata={"target_email": target.email, "company_id": target.company_id},
    )
    await db.commit()

    prim = primary_jwt_role(target)
    token = create_access_token(
        subject=target.id,
        extra_claims={
            "company_id": target.company_id,
            "role": prim.value,
            "roles": list(target.roles),
            "is_impersonating": True,
            "impersonator_sub": admin.id,
        },
    )
    return Token(access_token=token)


@router.post("/users/{user_id}/reset-password", status_code=status.HTTP_201_CREATED)
async def request_password_reset(
    user_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_system_admin)],
) -> dict[str, str]:
    u = await db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    raw = generate_raw_token()
    exp = datetime.now(timezone.utc) + timedelta(hours=settings.system_password_reset_expire_hours)
    db.add(
        SystemSecureToken(
            kind=SystemSecureTokenKind.password_reset,
            token_hash=hash_opaque_token(raw),
            email=u.email,
            user_id=u.id,
            expires_at=exp,
            created_by_user_id=admin.id,
        )
    )
    await record_system_log(
        db,
        action="user.password_reset_issued",
        performed_by=admin.id,
        target_type="user",
        target_id=u.id,
        metadata={"email": u.email, "company_id": u.company_id},
    )
    await db.commit()
    reset_path = _reset_path(raw)
    reset_url = _pulse_app_link(reset_path)
    reset_email_sent = await send_password_reset_email(
        settings,
        to_email=u.email,
        reset_url=reset_url,
    )
    return {"reset_link_path": reset_path, "reset_email_sent": reset_email_sent}


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def system_delete_user(
    user_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_system_admin)],
) -> None:
    if admin.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    u = await db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    if user_has_any_role(u, UserRole.system_admin):
        cnt = await db.execute(
            select(func.count())
            .select_from(User)
            .where(
                User.roles.overlap(pg_array([UserRole.system_admin.value])),
                User.id != user_id,
                User.is_active.is_(True),
            )
        )
        other_admins = int(cnt.scalar_one() or 0)
        if other_admins < 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete the last active system administrator",
            )

    await db.execute(delete(User).where(User.id == user_id))
    await record_system_log(
        db,
        action="user.deleted",
        performed_by=admin.id,
        target_type="user",
        target_id=user_id,
        metadata={"email": u.email, "roles": list(u.roles)},
    )
    await db.commit()


@router.get("/logs/actions", response_model=list[str])
async def list_system_log_actions(
    _: Annotated[User, Depends(require_system_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(300, ge=1, le=500),
) -> list[str]:
    q = await db.execute(
        select(SystemLog.action).distinct().order_by(SystemLog.action.asc()).limit(limit)
    )
    return [str(r[0]) for r in q.all()]


@router.get("/logs", response_model=list[SystemLogRow])
async def list_system_logs(
    _: Annotated[User, Depends(require_system_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    action: Optional[str] = Query(None, description="Exact action match"),
    search: Optional[str] = Query(None, description="Case-insensitive substring match on action"),
    target_type: Optional[str] = Query(None),
    target_id: Optional[str] = Query(None),
    performed_by: Optional[str] = Query(None, description="Actor user id (UUID)"),
    since: Optional[datetime] = Query(None, description="Inclusive lower bound on logged_at (ISO 8601)"),
    until: Optional[datetime] = Query(None, description="Inclusive upper bound on logged_at (ISO 8601)"),
) -> list[SystemLogRow]:
    stmt = select(SystemLog).order_by(SystemLog.logged_at.desc())
    if action:
        stmt = stmt.where(SystemLog.action == action)
    if search and search.strip():
        stmt = stmt.where(SystemLog.action.ilike(f"%{search.strip()}%"))
    if target_type and target_type.strip():
        stmt = stmt.where(SystemLog.target_type == target_type.strip())
    if target_id and target_id.strip():
        stmt = stmt.where(SystemLog.target_id == target_id.strip())
    if performed_by and performed_by.strip():
        stmt = stmt.where(SystemLog.performed_by == performed_by.strip())
    if since is not None:
        stmt = stmt.where(SystemLog.logged_at >= since)
    if until is not None:
        stmt = stmt.where(SystemLog.logged_at <= until)
    stmt = stmt.offset(offset).limit(limit)
    rows = (await db.execute(stmt)).scalars().all()
    return [
        SystemLogRow(
            id=r.id,
            action=r.action,
            performed_by=r.performed_by,
            target_type=r.target_type,
            target_id=r.target_id,
            metadata=dict(r.metadata_ or {}),
            logged_at=r.logged_at.isoformat(),
        )
        for r in rows
    ]


@router.get("/audit-legacy", include_in_schema=False)
async def list_global_audit_legacy(
    _: Annotated[User, Depends(require_system_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0, ge=0),
) -> list[dict[str, Any]]:
    from app.models.domain import AuditLog

    q = await db.execute(
        select(AuditLog).order_by(AuditLog.created_at.desc()).offset(offset).limit(limit)
    )
    rows = q.scalars().all()
    return [
        {
            "id": r.id,
            "actor_user_id": r.actor_user_id,
            "company_id": r.company_id,
            "action": r.action,
            "metadata": r.metadata_,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]
