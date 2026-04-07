"""Hierarchical user provisioning and permission templates."""

from datetime import datetime, timedelta, timezone
from typing import Annotated, Any
from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_current_user,
    require_company_admin_scoped,
    require_manager_or_above,
)
from app.core.audit.service import record_audit
from app.core.config import get_settings
from app.core.database import get_db
from app.core.email_smtp import send_employee_invite
from app.core.permissions import keys as perm_keys
from app.core.permissions.service import PermissionService
from app.core.system_tokens import generate_raw_token, hash_system_token
from app.core.user_roles import (
    default_operational_role_for_invite_role,
    user_has_any_role,
    user_roles_subset_of,
    validate_tenant_roles_non_empty,
)
from app.models.domain import Company, RolePermissionTarget, User, UserAccountStatus, UserRole
from app.schemas.rbac import AssignRoleBody, CompanyUserCreate, RolePermissionsPut, WorkerDenyPatch

router = APIRouter(prefix="/users", tags=["users"])


def _ensure_same_company(actor: User, target_company_id: str) -> None:
    if user_has_any_role(actor, UserRole.system_admin):
        return
    if actor.company_id is None or str(actor.company_id) != str(target_company_id):
        raise HTTPException(status_code=403, detail="Company mismatch")


def _join_path(raw_token: str) -> str:
    return f"/join?token={quote(raw_token, safe='')}"


def _public_link(path: str) -> str:
    base = get_settings().pulse_app_public_origin.rstrip("/")
    return f"{base}{path if path.startswith('/') else '/' + path}"


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_company_user(
    body: CompanyUserCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(get_current_user)],
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    """company_admin: invite worker | lead | supervisor | manager. manager: worker | lead only."""
    if user_has_any_role(actor, UserRole.system_admin):
        raise HTTPException(
            status_code=403,
            detail="system_admin must use POST /api/system/companies to provision orgs",
        )
    if user_has_any_role(actor, UserRole.company_admin):
        if body.role not in ("manager", "worker", "lead", "supervisor"):
            raise HTTPException(
                status_code=403,
                detail="company_admin may only invite workers, leads, supervisors, or managers",
            )
    elif user_has_any_role(actor, UserRole.manager):
        if body.role not in ("worker", "lead"):
            raise HTTPException(status_code=403, detail="Managers may only invite workers or leads")
    elif user_has_any_role(actor, UserRole.supervisor):
        if body.role not in ("worker", "lead"):
            raise HTTPException(status_code=403, detail="Supervisors may only invite workers or leads")
    else:
        raise HTTPException(status_code=403, detail="Not allowed to create users")

    if actor.company_id is None:
        raise HTTPException(status_code=400, detail="Actor has no company")

    company_id = str(actor.company_id)
    email_norm = body.email.strip().lower()
    settings = get_settings()
    exp = datetime.now(timezone.utc) + timedelta(hours=settings.system_invite_expire_hours)
    raw = generate_raw_token()
    th = hash_system_token(raw)

    exq = await db.execute(select(User).where(func.lower(User.email) == email_norm))
    ex = exq.scalar_one_or_none()
    if ex:
        if str(ex.company_id) != company_id:
            raise HTTPException(status_code=400, detail="Email already in use")
        if ex.account_status == UserAccountStatus.active:
            raise HTTPException(status_code=400, detail="Email already in use")
        user = ex
        re = UserRole(body.role)
        user.roles = [re.value]
        user.operational_role = default_operational_role_for_invite_role(re)
        user.full_name = body.full_name
        user.hashed_password = None
        user.account_status = UserAccountStatus.invited
        user.invite_token_hash = th
        user.invite_expires_at = exp
        user.is_active = True
        user.created_by = actor.id
    else:
        role_enum = UserRole(body.role)
        user = User(
            company_id=company_id,
            email=email_norm,
            hashed_password=None,
            full_name=body.full_name,
            roles=[role_enum.value],
            operational_role=default_operational_role_for_invite_role(role_enum),
            created_by=actor.id,
            account_status=UserAccountStatus.invited,
            invite_token_hash=th,
            invite_expires_at=exp,
            is_active=True,
        )
        db.add(user)
    await db.flush()

    await record_audit(
        db,
        action="users.invited",
        actor_user_id=actor.id,
        company_id=company_id,
        metadata={"new_user_id": user.id, "role": body.role},
    )

    co = await db.get(Company, company_id)
    co_name = co.name if co else "your organization"
    link_path = _join_path(raw)
    invite_url = _public_link(link_path)
    if settings.smtp_configured:

        async def _send() -> None:
            cfg = get_settings()
            await send_employee_invite(cfg, to_email=email_norm, company_name=co_name, invite_url=invite_url)

        background_tasks.add_task(_send)

    await db.commit()
    return {"id": user.id, "invite_link_path": link_path, "message": "Invite sent"}


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

    if user_has_any_role(target, UserRole.company_admin):
        raise HTTPException(status_code=400, detail="Cannot change company_admin role here")
    old_roles = list(target.roles)
    try:
        if body.roles is not None:
            new_roles = validate_tenant_roles_non_empty(list(body.roles))
        else:
            new_roles = [UserRole(body.role or "").value]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    target.roles = new_roles
    await db.flush()
    await record_audit(
        db,
        action="users.role_changed",
        actor_user_id=admin.id,
        company_id=admin.company_id,
        metadata={
            "target_user_id": user_id,
            "old_roles": old_roles,
            "new_roles": new_roles,
        },
    )
    await db.commit()
    return {"id": user_id, "role": new_roles[0], "roles": new_roles}


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
    if user_has_any_role(actor, UserRole.system_admin):
        raise HTTPException(status_code=403, detail="Impersonate a company user to edit worker denies")
    if actor.company_id is None:
        raise HTTPException(status_code=400, detail="Invalid actor")

    q = await db.execute(select(User).where(User.id == user_id))
    target = q.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if not user_roles_subset_of(target, (UserRole.worker, UserRole.lead)):
        raise HTTPException(status_code=400, detail="Deny overlay applies to workers and leads only")

    _ensure_same_company(actor, str(target.company_id))

    if user_has_any_role(actor, UserRole.manager, UserRole.supervisor):
        if not await PermissionService(db).user_has(actor, perm_keys.USERS_INVITE_WORKER):
            raise HTTPException(status_code=403, detail="Missing permission")

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
