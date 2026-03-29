"""Authentication: login, session info, impersonation (system_admin), effective permissions."""

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_system_admin
from app.core.audit.service import record_audit
from app.core.auth.security import create_access_token, decode_token, hash_password, verify_password
from app.core.database import get_db
from app.core.company_features import list_enabled_names
from app.core.features.service import MODULE_KEYS, FeatureFlagService
from app.core.permissions.service import PermissionService
from app.core.system_audit import record_system_log
from app.core.system_tokens import hash_system_token
from app.limiter import limiter
from app.models.domain import Company, Invite, SystemSecureToken, SystemSecureTokenKind, User, UserRole
from app.schemas.auth import (
    EffectivePermissionsOut,
    ImpersonateRequest,
    InviteAcceptBody,
    LoginRequest,
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
    token = create_access_token(
        subject=user.id,
        extra_claims={
            "company_id": user.company_id,
            "role": user.role.value,
            "is_impersonating": is_impersonating,
            "impersonator_sub": impersonator_sub,
        },
    )
    return Token(access_token=token)


@router.post("/login", response_model=Token)
@limiter.limit("30/minute")
async def login(
    request: Request,
    body: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Token:
    q = await db.execute(select(User).where(User.email == body.email))
    user = q.scalar_one_or_none()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    user.last_login = datetime.now(timezone.utc)
    await record_audit(
        db,
        action="auth.login",
        actor_user_id=user.id,
        company_id=user.company_id,
        metadata={"email": user.email},
    )
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

    feats: list[str] = []
    if user.company_id:
        raw_feats = await list_enabled_names(db, user.company_id)
        feats = sorted({f for f in raw_feats if f in MODULE_KEYS})

    return UserOut(
        id=user.id,
        email=user.email,
        company_id=user.company_id,
        role=user.role.value,
        full_name=user.full_name,
        enabled_features=feats,
        is_impersonating=is_imp,
        is_system_admin=bool(user.is_system_admin or user.role == UserRole.system_admin),
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
    if not (admin.is_system_admin or admin.role == UserRole.system_admin):
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

    new_user = User(
        company_id=company.id,
        email=row.email or "",
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        role=_invite_role(row.role),
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


@router.post("/password-reset/confirm", response_model=Token)
@limiter.limit("10/minute")
async def confirm_password_reset(
    request: Request,
    body: PasswordResetConfirmBody,
    db: Annotated[AsyncSession, Depends(get_db)],
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
    u.hashed_password = hash_password(body.new_password)
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
