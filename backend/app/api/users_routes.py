"""Hierarchical user provisioning and permission templates."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_current_user,
    require_company_admin_scoped,
    require_manager_or_above,
)
from app.core.audit.service import record_audit
from app.core.auth.security import hash_password
from app.core.database import get_db
from app.core.permissions import keys as perm_keys
from app.core.permissions.service import PermissionService
from app.models.domain import RolePermissionTarget, User, UserRole
from app.schemas.rbac import AssignRoleBody, CompanyUserCreate, RolePermissionsPut, WorkerDenyPatch

router = APIRouter(prefix="/users", tags=["users"])


def _ensure_same_company(actor: User, target_company_id: str) -> None:
    if actor.role == UserRole.system_admin:
        return
    if actor.company_id is None or str(actor.company_id) != str(target_company_id):
        raise HTTPException(status_code=403, detail="Company mismatch")


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_company_user(
    body: CompanyUserCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(get_current_user)],
) -> dict[str, str]:
    """company_admin: manager | worker. manager: worker only."""
    if actor.role == UserRole.system_admin:
        raise HTTPException(
            status_code=403,
            detail="system_admin must use POST /api/system/companies to provision orgs",
        )
    if actor.role == UserRole.manager:
        if body.role != "worker":
            raise HTTPException(status_code=403, detail="Managers may only create workers")
    elif actor.role == UserRole.company_admin:
        if body.role not in ("manager", "worker"):
            raise HTTPException(status_code=403, detail="company_admin may only create managers or workers")
    else:
        raise HTTPException(status_code=403, detail="Not allowed to create users")

    if actor.company_id is None:
        raise HTTPException(status_code=400, detail="Actor has no company")

    company_id = actor.company_id

    exists = await db.execute(select(User).where(User.email == body.email))
    if exists.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already in use")

    role_enum = UserRole(body.role)
    user = User(
        company_id=company_id,
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        role=role_enum,
        created_by=actor.id,
    )
    db.add(user)
    await db.flush()

    await record_audit(
        db,
        action="users.created",
        actor_user_id=actor.id,
        company_id=company_id,
        metadata={"new_user_id": user.id, "role": body.role},
    )
    await db.commit()
    return {"id": user.id}


@router.patch("/{user_id}/role")
async def assign_role(
    user_id: str,
    body: AssignRoleBody,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_company_admin_scoped)],
) -> dict[str, str]:
    _ensure_same_company(admin, str(admin.company_id))
    q = await db.execute(select(User).where(User.id == user_id))
    target = q.scalar_one_or_none()
    if not target or str(target.company_id) != str(admin.company_id):
        raise HTTPException(status_code=404, detail="User not found")

    if target.role == UserRole.company_admin:
        raise HTTPException(status_code=400, detail="Cannot change company_admin role here")
    new_role = UserRole(body.role)
    old = target.role.value
    target.role = new_role
    await db.flush()
    await record_audit(
        db,
        action="users.role_changed",
        actor_user_id=admin.id,
        company_id=admin.company_id,
        metadata={"target_user_id": user_id, "old_role": old, "new_role": new_role.value},
    )
    await db.commit()
    return {"id": user_id, "role": new_role.value}


@router.put("/permissions/roles")
async def put_role_permissions(
    body: RolePermissionsPut,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_company_admin_scoped)],
) -> dict[str, Any]:
    target = RolePermissionTarget(body.role)
    svc = PermissionService(db)
    row = await svc.upsert_role_template(str(admin.company_id), target, body.allow)
    await record_audit(
        db,
        action="permissions.role_template_updated",
        actor_user_id=admin.id,
        company_id=admin.company_id,
        metadata={"role": body.role, "allow": body.allow},
    )
    await db.commit()
    return {"company_id": str(admin.company_id), "role": body.role, "allow": body.allow}


@router.patch("/{user_id}/worker-deny")
async def patch_worker_deny(
    user_id: str,
    body: WorkerDenyPatch,
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_manager_or_above)],
) -> dict[str, Any]:
    if actor.role == UserRole.system_admin:
        raise HTTPException(status_code=403, detail="Impersonate a company user to edit worker denies")
    if actor.company_id is None:
        raise HTTPException(status_code=400, detail="Invalid actor")

    q = await db.execute(select(User).where(User.id == user_id))
    target = q.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.role != UserRole.worker:
        raise HTTPException(status_code=400, detail="Deny overlay applies to workers only")

    _ensure_same_company(actor, str(target.company_id))

    if actor.role == UserRole.manager:
        if not await PermissionService(db).user_has(actor, perm_keys.USERS_INVITE_WORKER):
            raise HTTPException(status_code=403, detail="Missing permission")
        # Manager may only tighten workers in same company (already checked).
        pass

    target.permission_deny = body.deny
    await db.flush()
    await record_audit(
        db,
        action="permissions.worker_deny_updated",
        actor_user_id=actor.id,
        company_id=target.company_id,
        metadata={"target_user_id": user_id, "deny": body.deny},
    )
    await db.commit()
    return {"id": user_id, "deny": body.deny}
