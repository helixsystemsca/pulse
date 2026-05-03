"""FastAPI dependencies: DB session, auth, RBAC, core services."""

from collections.abc import Awaitable, Callable
from typing import Annotated, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth.security import decode_token
from app.core.database import get_db
from app.core.user_roles import (
    primary_jwt_role,
    roles_match_token,
    user_has_any_role,
    user_has_facility_tenant_admin_flag,
    user_has_tenant_full_admin,
)
from app.core.events.engine import event_engine
from app.core.features.service import FeatureFlagService
from app.core.inference.engine import InferenceEngine
from app.core.permissions.service import PermissionService
from app.core.state.manager import StateManager
from app.models.domain import User, UserAccountStatus, UserRole
from app.schemas.auth import TokenPayload
from sqlalchemy import select

security = HTTPBearer(auto_error=False)


async def get_current_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    creds: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security)],
) -> User:
    if creds is None or not creds.credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload_raw = decode_token(creds.credentials)
        payload = TokenPayload.model_validate(
            {
                "sub": payload_raw["sub"],
                "company_id": payload_raw.get("company_id"),
                "role": payload_raw["role"],
                "roles": payload_raw.get("roles"),
                "is_impersonating": payload_raw.get("is_impersonating", False),
                "impersonator_sub": payload_raw.get("impersonator_sub"),
            }
        )
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    q = await db.execute(select(User).where(User.id == payload.sub))
    user = q.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive or missing")

    if payload.roles is None:
        if primary_jwt_role(user).value != payload.role:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    elif not roles_match_token(list(user.roles), payload.roles, payload.role):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    if user.account_status != UserAccountStatus.active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account not activated")

    if user_has_any_role(user, UserRole.system_admin):
        if payload.company_id is not None or user.company_id is not None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    else:
        if user.company_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        if str(user.company_id) != str(payload.company_id):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    return user


require_auth = get_current_user


def require_role(*roles: UserRole) -> Callable[..., Awaitable[User]]:
    async def _dep(user: User = Depends(get_current_user)) -> User:
        if not user_has_any_role(user, *roles):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return user

    return _dep


async def get_current_company_user(user: Annotated[User, Depends(get_current_user)]) -> User:
    """Tenant-only principal: system admins must impersonate to access company-scoped APIs."""
    if user_has_any_role(user, UserRole.system_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This resource requires a company user account",
        )
    if user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This resource requires a company user account",
        )
    return user


async def get_current_company_admin_user(user: Annotated[User, Depends(get_current_company_user)]) -> User:
    """External `company_admin` or in-facility tenant delegate. For destructive tenant operations."""
    if not user_has_tenant_full_admin(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="company_admin role required",
        )
    return user


async def require_tenant_user(
    user: Annotated[User, Depends(get_current_company_user)],
) -> User:
    """Same as `get_current_company_user` — kept for existing imports."""
    return user


async def require_system_admin(user: Annotated[User, Depends(get_current_user)]) -> User:
    if not (user.is_system_admin or user_has_any_role(user, UserRole.system_admin)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="system_admin only")
    return user


async def require_company_admin(user: Annotated[User, Depends(get_current_user)]) -> User:
    if not (
        user.is_system_admin
        or user_has_any_role(user, UserRole.system_admin)
        or user_has_tenant_full_admin(user)
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="company_admin only")
    return user


async def require_company_admin_scoped(user: Annotated[User, Depends(get_current_user)]) -> User:
    """Tenant full admin within their org: external `company_admin` role or facility delegate (not system_admin)."""
    if user_has_any_role(user, UserRole.system_admin) or user.is_system_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Use tenant-scoped credentials (not system_admin) for this resource",
        )
    if not user_has_tenant_full_admin(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="company_admin only")
    return user


async def require_manager_or_above(user: Annotated[User, Depends(get_current_user)]) -> User:
    if not (
        user_has_any_role(
            user,
            UserRole.system_admin,
            UserRole.company_admin,
            UserRole.manager,
            UserRole.supervisor,
        )
        or user_has_facility_tenant_admin_flag(user)
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="manager or above required")
    return user


async def require_pm_features_user(user: Annotated[User, Depends(get_current_company_user)]) -> User:
    """Internal PM coordination APIs (`/api/v1/pm-coord/*`). Gated by user flag, not tenant role."""
    if not bool(getattr(user, "can_use_pm_features", False)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="pm_features_disabled",
        )
    return user


def require_company_access(company_id: str) -> Callable[..., Awaitable[User]]:
    async def _inner(user: User = Depends(get_current_user)) -> User:
        if user_has_any_role(user, UserRole.system_admin):
            return user
        if user.company_id is None or str(user.company_id) != str(company_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Company access denied")
        return user

    return _inner


def require_permission(permission: str) -> Callable[..., Awaitable[User]]:
    async def _inner(
        user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        if user_has_any_role(user, UserRole.system_admin, UserRole.company_admin) or user_has_facility_tenant_admin_flag(
            user
        ):
            return user
        svc = PermissionService(db)
        if not await svc.user_has(user, permission):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")
        return user

    return _inner


def get_permission_service(db: Annotated[AsyncSession, Depends(get_db)]) -> PermissionService:
    return PermissionService(db)


def get_state_manager(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> StateManager:
    return StateManager(db, event_engine)


def get_inference_engine(
    db: Annotated[AsyncSession, Depends(get_db)],
    state: Annotated[StateManager, Depends(get_state_manager)],
) -> InferenceEngine:
    return InferenceEngine(db, event_engine, state)


def get_feature_service(db: Annotated[AsyncSession, Depends(get_db)]) -> FeatureFlagService:
    return FeatureFlagService(db)
