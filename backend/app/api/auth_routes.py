"""Authentication: login, session info, impersonation (system_admin), effective permissions."""

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_system_admin
from app.core.audit.service import record_audit
from app.core.auth.password_policy import validate_new_password
from app.core.auth.security import (
    bump_access_token_version,
    create_access_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.core.config import Settings, get_settings
from app.core.database import get_db
from app.core.login_activity import log_login_event
from app.core.microsoft_oauth import MicrosoftOAuthError, MicrosoftIdentity, verify_supabase_microsoft_access_token
from app.core.permissions.service import PermissionService
from app.core.rbac.resolve import effective_rbac_permission_keys
from app.core.workspace_departments import primary_hr_department_slug_for_auth
from app.core.system_audit import record_system_log
from app.core.system_tokens import hash_system_token
from app.limiter import limiter
from app.core.user_roles import (
    primary_jwt_role,
    tenant_role_display_label,
    user_has_any_role,
)
from app.models.domain import (
    Company,
    Invite,
    SystemSecureToken,
    SystemSecureTokenKind,
    User,
    UserAccountStatus,
    UserRole,
)
from app.models.pulse_models import PulseWorkerHR
from app.schemas.auth import (
    CompanySummaryOut,
    EffectivePermissionsOut,
    EmployeeInviteAcceptBody,
    ImpersonateRequest,
    InviteAcceptBody,
    LoginRequest,
    MicrosoftOAuthRequest,
    PasswordResetConfirmBody,
    Token,
    UserOut,
)

exit_bearer = HTTPBearer(auto_error=True)

router = APIRouter(prefix="/auth", tags=["auth"])


def _invite_role(raw: str) -> UserRole:
    try:
        return UserRole(raw)
    except ValueError:
        return UserRole.company_admin


def _token_for_user(
    user: User,
    *,
    is_impersonating: bool = False,
    impersonator_sub: str | None = None,
) -> Token:
    prim = primary_jwt_role(user)
    token = create_access_token(
        subject=user.id,
        extra_claims={
            "company_id": user.company_id,
            "role": prim.value,
            "roles": list(user.roles),
            "is_impersonating": is_impersonating,
            "impersonator_sub": impersonator_sub,
            "tv": int(getattr(user, "token_version", 0) or 0),
        },
    )
    return Token(access_token=token)


def _oauth_error_response(exc: MicrosoftOAuthError) -> HTTPException:
    if exc.reason == "supabase_not_configured":
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Microsoft sign-in is not configured.",
        )
    if exc.reason == "missing_email":
        return HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Microsoft did not provide an email address for this account.",
        )
    if exc.reason == "provider_not_microsoft":
        return HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This Supabase session was not issued by Microsoft.",
        )
    if exc.reason == "invalid_supabase_session":
        return HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Microsoft sign-in session expired. Try signing in again.",
        )
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Microsoft sign-in is temporarily unavailable.",
    )


async def _upsert_microsoft_user(
    db: AsyncSession,
    identity: MicrosoftIdentity,
) -> tuple[User, bool]:
    q = await db.execute(select(User).where(func.lower(User.email) == identity.email))
    user = q.scalar_one_or_none()
    created = False

    if user is None:
        created = True
        user = User(
            email=identity.email,
            hashed_password=None,
            auth_provider="microsoft",
            full_name=identity.display_name,
            avatar_url=identity.avatar_url,
            roles=[UserRole.worker.value],
            operational_role=UserRole.worker.value,
            account_status=UserAccountStatus.active,
            is_active=True,
        )
        db.add(user)
        try:
            await db.flush()
        except IntegrityError:
            await db.rollback()
            created = False
            q = await db.execute(select(User).where(func.lower(User.email) == identity.email))
            user = q.scalar_one_or_none()
            if user is None:
                raise

    if not user.is_active or user.account_status != UserAccountStatus.active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account is not active.")

    user.auth_provider = "microsoft"
    if identity.display_name and not (user.full_name or "").strip():
        user.full_name = identity.display_name
    if identity.avatar_url and not (user.avatar_url or "").strip():
        user.avatar_url = identity.avatar_url
    return user, created


@router.post("/login", response_model=Token)
@limiter.limit("8/minute")
async def login(
    request: Request,
    body: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> Token:
    email_norm = str(body.email).strip().lower()
    now = datetime.now(timezone.utc)
    q = await db.execute(select(User).where(func.lower(User.email) == email_norm))
    user = q.scalar_one_or_none()
    if not user or not user.is_active:
        await record_audit(
            db,
            action="auth.login_failed",
            metadata={"email": email_norm, "reason": "unknown_or_inactive_user"},
        )
        await db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if user.account_status != UserAccountStatus.active:
        await record_audit(
            db,
            action="auth.login_failed",
            actor_user_id=user.id,
            company_id=user.company_id,
            metadata={"email": email_norm, "reason": "account_not_active"},
        )
        await db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if user.locked_until and user.locked_until > now:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Account temporarily locked after repeated failed sign-ins. Try again later or reset your password.",
        )
    if not verify_password(body.password, user.hashed_password):
        user.failed_login_attempts = int(getattr(user, "failed_login_attempts", 0) or 0) + 1
        if user.failed_login_attempts >= settings.login_lockout_max_attempts:
            user.locked_until = now + timedelta(minutes=settings.login_lockout_minutes)
        await record_audit(
            db,
            action="auth.login_failed",
            actor_user_id=user.id,
            company_id=user.company_id,
            metadata={"email": email_norm, "reason": "bad_password"},
        )
        await db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    user.auth_provider = "email"
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login = now
    user.last_active_at = now
    await record_audit(
        db,
        action="auth.login",
        actor_user_id=user.id,
        company_id=user.company_id,
        metadata={"email": user.email},
    )
    await log_login_event(db, request, user)
    await db.commit()
    return _token_for_user(user)


@router.post("/oauth/microsoft", response_model=Token)
@limiter.limit("12/minute")
async def microsoft_oauth_login(
    request: Request,
    body: MicrosoftOAuthRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> Token:
    try:
        identity = await verify_supabase_microsoft_access_token(settings, body.access_token)
    except MicrosoftOAuthError as exc:
        raise _oauth_error_response(exc) from exc

    user, created = await _upsert_microsoft_user(db, identity)
    now = datetime.now(timezone.utc)
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login = now
    user.last_active_at = now
    await record_audit(
        db,
        action="auth.microsoft_login",
        actor_user_id=user.id,
        company_id=user.company_id,
        metadata={
            "email": user.email,
            "provider": "microsoft",
            "supabase_user_id": identity.supabase_user_id,
            "created_internal_user": created,
        },
    )
    await log_login_event(db, request, user)
    await db.commit()
    return _token_for_user(user)


@router.post("/impersonate", response_model=Token)
@limiter.limit("20/minute")
async def impersonate(
    request: Request,
    body: ImpersonateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_system_admin)],
) -> Token:
    q = await db.execute(select(User).where(User.id == body.target_user_id))
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
    await db.commit()
    return _token_for_user(
        target,
        is_impersonating=True,
        impersonator_sub=admin.id,
    )


@router.get("/me", response_model=UserOut)
async def me(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    request: Request,
) -> UserOut:
    """
    Tenant session envelope. Contract + matrix + grants are resolved from the database on **every** request;
    JWT carries identity + `tv` only. The SPA persists this payload in ``localStorage`` (``pulse_auth_v2``) and
    must call ``refreshPulseUserFromServer`` (or reload) to pick up Team Management changes made while the tab is open.
    """
    # Claims for UI impersonation hint (re-decode would duplicate; use header optional)
    is_imp = False
    try:
        auth = request.headers.get("authorization") or ""
        if auth.lower().startswith("bearer "):
            from app.core.auth.security import decode_token

            raw = decode_token(auth.split(None, 1)[1])
            is_imp = bool(raw.get("is_impersonating"))
    except Exception:
        pass

    from app.core.access_snapshot import resolve_access_snapshot
    from app.schemas.access_snapshot import AccessSnapshotOut

    access_snap = await resolve_access_snapshot(db, user)
    contract_feats = access_snap.contract_features
    eff_feats = access_snap.features
    rbac_keys = access_snap.capabilities
    roster_access = access_snap.workers_roster_access
    contract_admin_catalog = list(contract_feats) if access_snap.is_company_admin else []

    company_summary: CompanySummaryOut | None = None
    if user.company_id:
        co = await db.get(Company, user.company_id)
        if co:
            company_summary = CompanySummaryOut(
                id=co.id,
                name=co.name,
                logo_url=co.logo_url,
                header_image_url=co.header_image_url,
                background_image_url=getattr(co, "background_image_url", None),
                timezone=co.timezone,
                industry=co.industry,
            )

    prim = primary_jwt_role(user)
    perm_out: list[str] | None = None
    if user.company_id and not (
        user.is_system_admin or user_has_any_role(user, UserRole.system_admin)
    ):
        psvc = PermissionService(db)
        eff = await psvc.effective_allow_set(user)
        perm_out = ["*"] if "*" in eff else sorted(eff)

    must_change_password = bool(user.hashed_password) and verify_password("Panorama", user.hashed_password)

    hr_me: PulseWorkerHR | None = None
    if user.company_id:
        hr_row = await db.execute(select(PulseWorkerHR).where(PulseWorkerHR.user_id == user.id))
        hr_me = hr_row.scalar_one_or_none()

    extras_raw = getattr(user, "feature_allow_extra", None) or []
    feature_allow_out = [str(x) for x in extras_raw if isinstance(x, str)] if user.company_id else []
    tr_id = getattr(user, "tenant_role_id", None)
    tenant_role_out = str(tr_id) if tr_id else None

    if os.getenv("PULSE_AUTH_ME_ENTITLEMENTS_LOG", "").lower() in ("1", "true", "yes"):
        logging.getLogger("pulse.auth_me").info(
            "auth_me entitlements user_id=%s company_id=%s roles=%s facility_tenant_admin=%s tenant_role_id=%s "
            "contract_features=%s enabled_features=%s rbac_permissions=%s feature_allow_extra=%s permissions_legacy=%s",
            user.id,
            user.company_id,
            list(user.roles or []),
            bool(getattr(user, "facility_tenant_admin", False)),
            tenant_role_out,
            contract_feats,
            eff_feats,
            rbac_keys,
            feature_allow_out,
            perm_out,
        )

    return UserOut(
        id=user.id,
        email=user.email,
        company_id=user.company_id,
        role=prim.value,
        roles=list(user.roles),
        full_name=user.full_name,
        auth_provider=getattr(user, "auth_provider", None) or "email",
        avatar_url=user.avatar_url,
        avatar_status=getattr(user, "avatar_status", None).value if getattr(user, "avatar_status", None) else None,
        job_title=user.job_title,
        operational_role=(str(user.operational_role).strip() or None) if user.operational_role else None,
        enabled_features=eff_feats,
        contract_features=contract_feats,
        rbac_permissions=rbac_keys,
        contract_enabled_features=contract_admin_catalog if contract_admin_catalog else None,
        workers_roster_access=roster_access,
        is_impersonating=is_imp,
        is_system_admin=bool(user.is_system_admin or user_has_any_role(user, UserRole.system_admin)),
        company=company_summary,
        can_use_pm_features=bool(getattr(user, "can_use_pm_features", False)),
        facility_tenant_admin=bool(getattr(user, "facility_tenant_admin", False)),
        role_display_label=tenant_role_display_label(user),
        permissions=perm_out,
        department_workspace_slugs=[],
        hr_department=primary_hr_department_slug_for_auth(hr_me),
        feature_allow_extra=feature_allow_out if user.company_id else None,
        tenant_role_id=tenant_role_out,
        server_time=datetime.now(timezone.utc).isoformat(),
        must_change_password=must_change_password,
        access_snapshot=AccessSnapshotOut.model_validate(access_snap.as_dict()),
    )


@router.post("/impersonation/exit", response_model=Token)
@limiter.limit("30/minute")
async def exit_impersonation(
    request: Request,
    creds: Annotated[HTTPAuthorizationCredentials, Depends(exit_bearer)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Token:
    try:
        payload = decode_token(creds.credentials)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    if not payload.get("is_impersonating"):
        raise HTTPException(status_code=400, detail="Not impersonating")
    imp_id = payload.get("impersonator_sub")
    if not imp_id:
        raise HTTPException(status_code=400, detail="Missing impersonator")

    q = await db.execute(select(User).where(User.id == imp_id))
    admin = q.scalar_one_or_none()
    if not admin or not admin.is_active:
        raise HTTPException(status_code=401, detail="Impersonator no longer valid")
    if not (admin.is_system_admin or user_has_any_role(admin, UserRole.system_admin)):
        raise HTTPException(status_code=403, detail="Impersonator is not system admin")

    await record_audit(
        db,
        action="auth.impersonation.end",
        actor_user_id=admin.id,
        company_id=None,
        metadata={"ended_via": "exit_endpoint"},
    )
    await record_system_log(
        db,
        action="user.impersonation_end",
        performed_by=admin.id,
        metadata={},
    )
    await db.commit()
    return _token_for_user(admin)


@router.post("/invite-accept", response_model=Token)
@limiter.limit("15/minute")
async def accept_invite(
    request: Request,
    body: InviteAcceptBody,
    db: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> Token:
    th = hash_system_token(body.token)
    now = datetime.now(timezone.utc)
    tq = await db.execute(
        select(Invite).where(
            Invite.token_hash == th,
            Invite.used.is_(False),
            Invite.expires_at > now,
        )
    )
    row = tq.scalar_one_or_none()
    if not row or not row.email:
        raise HTTPException(status_code=400, detail="Invalid or expired invite")

    company = await db.get(Company, row.company_id)
    if not company or not company.is_active:
        raise HTTPException(status_code=400, detail="Company not available")

    exists = await db.execute(select(User).where(User.email == row.email))
    if exists.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    try:
        validate_new_password(body.password, settings)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    invited = _invite_role(row.role)
    new_user = User(
        company_id=company.id,
        email=row.email or "",
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        roles=[invited.value],
        created_by=row.created_by_user_id,
    )
    db.add(new_user)
    await db.flush()
    if company.owner_admin_id is None:
        company.owner_admin_id = new_user.id
    row.used = True
    await record_system_log(
        db,
        action="invite.accepted",
        performed_by=new_user.id,
        target_type="company",
        target_id=company.id,
        metadata={"email": new_user.email, "target_user_id": new_user.id},
    )
    await db.commit()
    return _token_for_user(new_user)


@router.post("/employee-invite-accept", response_model=Token)
@limiter.limit("15/minute")
async def accept_employee_invite(
    request: Request,
    body: EmployeeInviteAcceptBody,
    db: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> Token:
    th = hash_system_token(body.token)
    now = datetime.now(timezone.utc)
    tq = await db.execute(
        select(User).where(
            User.invite_token_hash == th,
            User.account_status == UserAccountStatus.invited,
            User.invite_expires_at.isnot(None),
            User.invite_expires_at > now,
        )
    )
    user = tq.scalar_one_or_none()
    if not user or not user.company_id:
        raise HTTPException(status_code=400, detail="Invalid or expired invite")

    co = await db.get(Company, user.company_id)
    if not co or not co.is_active:
        raise HTTPException(status_code=400, detail="Organization not available")

    try:
        validate_new_password(body.password, settings)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    user.hashed_password = hash_password(body.password)
    if body.full_name and body.full_name.strip():
        user.full_name = body.full_name.strip()
    user.account_status = UserAccountStatus.active
    user.invite_token_hash = None
    user.invite_expires_at = None
    user.is_active = True

    await record_audit(
        db,
        action="auth.employee_invite_accepted",
        actor_user_id=user.id,
        company_id=user.company_id,
        metadata={"email": user.email},
    )
    await db.commit()
    return _token_for_user(user)


@router.post("/password-reset/confirm", response_model=Token)
@limiter.limit("10/minute")
async def confirm_password_reset(
    request: Request,
    body: PasswordResetConfirmBody,
    db: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> Token:
    th = hash_system_token(body.token)
    now = datetime.now(timezone.utc)
    tq = await db.execute(
        select(SystemSecureToken).where(
            SystemSecureToken.token_hash == th,
            SystemSecureToken.kind == SystemSecureTokenKind.password_reset,
            SystemSecureToken.used_at.is_(None),
            SystemSecureToken.expires_at > now,
        )
    )
    row = tq.scalar_one_or_none()
    if not row or not row.user_id:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")

    u = await db.get(User, row.user_id)
    if not u:
        raise HTTPException(status_code=400, detail="User missing")
    try:
        validate_new_password(body.new_password, settings)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    u.hashed_password = hash_password(body.new_password)
    bump_access_token_version(u)
    row.used_at = now
    await record_system_log(
        db,
        action="user.password_reset_completed",
        target_type="user",
        target_id=u.id,
        metadata={"email": u.email, "company_id": u.company_id},
    )
    await db.commit()
    return _token_for_user(u)


@router.get("/permissions", response_model=EffectivePermissionsOut)
async def my_permissions(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> EffectivePermissionsOut:
    svc = PermissionService(db)
    eff = await svc.effective_allow_set(user)
    if "*" in eff:
        return EffectivePermissionsOut(permissions=["*"])
    return EffectivePermissionsOut(permissions=sorted(eff))
