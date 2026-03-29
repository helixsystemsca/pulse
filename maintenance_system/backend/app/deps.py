from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import safe_decode_token
from app.database import get_db
from app.models.domain import User, UserRole, WorkOrder

security_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = safe_decode_token(credentials.credentials)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user_id = str(payload["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def _is_privileged(user: User) -> bool:
    return user.role in (UserRole.system_admin, UserRole.company_admin)


def _is_manager_plus(user: User) -> bool:
    return _is_privileged(user) or user.role == UserRole.manager


def is_manager_plus(user: User) -> bool:
    return _is_manager_plus(user)


def require_manager_plus(user: CurrentUser) -> User:
    if not _is_manager_plus(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Manager required")
    return user


def require_admin(user: CurrentUser) -> User:
    if not _is_privileged(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrator required")
    return user


ManagerUser = Annotated[User, Depends(require_manager_plus)]
AdminUser = Annotated[User, Depends(require_admin)]


def can_view_work_order(user: User, wo: WorkOrder) -> bool:
    if wo.company_id != user.company_id:
        return False
    if _is_manager_plus(user):
        return True
    return wo.assigned_to_user_id == user.id


def can_update_work_order_status(user: User, wo: WorkOrder) -> bool:
    if not can_view_work_order(user, wo):
        return False
    if _is_manager_plus(user):
        return True
    return wo.assigned_to_user_id == user.id
