"""Internal system administration (/api/system/*) — companies, invites, users, audit."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import require_system_admin
from app.core.audit.service import record_audit
from app.core.auth.security import create_access_token, hash_password as hash_pw
from app.core.config import get_settings
from app.core.database import get_db
from app.core.email_smtp import send_company_admin_invite, send_password_reset_email
from app.core.company_features import list_enabled_names, sync_enabled_features
from app.core.features.cache import invalidate
from app.core.features.service import MODULE_KEYS
from app.core.features.system_catalog import GLOBAL_SYSTEM_FEATURES, normalize_enabled_features
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
from app.schemas.system_admin import (
    SystemCompanyBootstrapPassword,
    SystemCompanyCreate,
    SystemCompanyCreateAndInvite,
    SystemCompanyPatch,
    SystemCompanyRow,
    SystemInviteCreate,
    SystemLogRow,
    SystemOverviewOut,
    SystemUserRow,
)

# Mounted in main.py at prefix `/api/system` — do not add another `/system` here or routes become `/api/system/system/...`.
router = APIRouter(tags=["system"])
settings = get_settings()


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
        if fname in feature_usage:
            feature_usage[fname] = int(cnt)

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
) -> dict[str, str]:
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
    invite_email_sent = await send_company_admin_invite(
        settings,
        to_email=email_norm,
        company_name=company.name,
        invite_url=invite_url,
    )
    return {
        "company_id": company.id,
        "invite_link_path": link_path,
        "invite_email_sent": invite_email_sent,
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
        role=UserRole.company_admin,
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
        ef = await list_enabled_names(db, c.id)
        out.append(
            SystemCompanyRow(
                id=c.id,
                name=c.name,
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
    ef = await list_enabled_names(db, c.id)
    return SystemCompanyRow(
        id=c.id,
        name=c.name,
        enabled_features=ef,
        user_count=cnt,
        is_active=c.is_active,
        owner_admin_id=c.owner_admin_id,
    )


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
    ef = await list_enabled_names(db, c.id)
    return SystemCompanyRow(
        id=c.id,
        name=c.name,
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


@router.get("/users", response_model=list[SystemUserRow])
async def list_all_users(
    _: Annotated[User, Depends(require_system_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    q: Optional[str] = Query(None),
) -> list[SystemUserRow]:
    stmt = select(User, Company.name).outerjoin(Company, User.company_id == Company.id)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            (User.email.ilike(like))
            | (User.full_name.ilike(like))
            | (Company.name.ilike(like))
        )
    stmt = stmt.order_by(User.created_at.desc()).offset(offset).limit(limit)
    rows = (await db.execute(stmt)).all()
    out: list[SystemUserRow] = []
    for u, company_name in rows:
        out.append(
            SystemUserRow(
                id=u.id,
                email=u.email,
                full_name=u.full_name,
                role=u.role.value,
                company_id=u.company_id,
                company_name=company_name,
                is_active=u.is_active,
                last_active_at=u.last_active_at.isoformat() if u.last_active_at else None,
            )
        )
    return out


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
    if target.role == UserRole.system_admin:
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

    token = create_access_token(
        subject=target.id,
        extra_claims={
            "company_id": target.company_id,
            "role": target.role.value,
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


@router.get("/logs", response_model=list[SystemLogRow])
async def list_system_logs(
    _: Annotated[User, Depends(require_system_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    action: Optional[str] = Query(None),
) -> list[SystemLogRow]:
    stmt = select(SystemLog).order_by(SystemLog.logged_at.desc()).offset(offset).limit(limit)
    if action:
        stmt = stmt.where(SystemLog.action == action)
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
