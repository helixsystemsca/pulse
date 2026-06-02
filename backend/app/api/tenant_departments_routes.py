"""Tenant department CRUD (`/api/workers/tenant-departments`)."""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.api.deps import get_current_user
from app.api.workers_routes import CompanyId, Db, resolve_workers_company_id
from app.core.rbac.resolve import effective_rbac_permission_keys
from app.core.tenant_context import log_tenant_context
from app.core.tenant_departments import (
    create_tenant_department,
    delete_tenant_department,
    list_tenant_departments,
    patch_tenant_department,
)
from app.core.tenant_feature_access import contract_and_effective_features_for_me
from app.core.user_roles import user_has_any_role, user_has_tenant_full_admin
from app.models.domain import User, UserRole
from app.schemas.tenant_departments import (
    TenantDepartmentCreateIn,
    TenantDepartmentListOut,
    TenantDepartmentOut,
    TenantDepartmentPatchIn,
)

router = APIRouter(prefix="/workers/tenant-departments", tags=["tenant-departments"])
_log = logging.getLogger(__name__)


async def require_tenant_department_reader(
    user: Annotated[User, Depends(get_current_user)],
    cid: Annotated[str, Depends(resolve_workers_company_id)],
) -> User:
    if user.is_system_admin or user_has_any_role(user, UserRole.system_admin):
        return user
    if user.company_id is None or str(user.company_id) != cid:
        raise HTTPException(status_code=403, detail="Company access denied")
    return user


async def require_tenant_department_manager(
    user: Annotated[User, Depends(get_current_user)],
    db: Db,
    cid: CompanyId,
) -> User:
    if user.is_system_admin or user_has_any_role(user, UserRole.system_admin, UserRole.company_admin):
        return user
    if user_has_tenant_full_admin(user):
        return user
    if user.company_id is None or str(user.company_id) != cid:
        raise HTTPException(status_code=403, detail="Company access denied")
    contract_feats, eff_feats, _, _ = await contract_and_effective_features_for_me(db, user)
    resolved = set(
        await effective_rbac_permission_keys(
            db,
            user,
            contract_feature_names=contract_feats,
            effective_feature_names=eff_feats,
        )
    )
    if "*" in resolved or "inventory.manage" in resolved:
        return user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Manage inventory or company admin access required to edit departments",
    )


TenantDeptReader = Annotated[User, Depends(require_tenant_department_reader)]
TenantDeptManager = Annotated[User, Depends(require_tenant_department_manager)]


def _out(row) -> TenantDepartmentOut:
    return TenantDepartmentOut(
        id=row.id,
        company_id=row.company_id,
        slug=row.slug,
        name=row.name,
        created_at=row.created_at,
    )


async def _list_departments_for_tenant(db: Db, cid: str, *, user_id: str) -> list:
    log_tenant_context(user_id=user_id, tenant_id=cid, path="/api/workers/tenant-departments")
    rows = await list_tenant_departments(db, cid)
    _log.info(
        "Tenant departments listed",
        extra={"tenant_id": cid, "department_count": len(rows)},
    )
    return rows


@router.get("", response_model=TenantDepartmentListOut)
async def list_departments(
    request: Request,
    db: Db,
    user: TenantDeptReader,
    cid: CompanyId,
) -> TenantDepartmentListOut:
    try:
        rows = await _list_departments_for_tenant(db, cid, user_id=str(user.id))
        return TenantDepartmentListOut(items=[_out(r) for r in rows])
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        _log.exception(
            "Tenant departments query failed tenant_id=%s path=%s",
            cid,
            request.url.path,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Tenant departments query failed: {exc.__class__.__name__}",
        ) from exc
    except Exception as exc:
        _log.exception(
            "Tenant departments unexpected error tenant_id=%s path=%s",
            cid,
            request.url.path,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Tenant departments failed: {exc.__class__.__name__}: {exc}",
        ) from exc


@router.post("", response_model=TenantDepartmentOut, status_code=status.HTTP_201_CREATED)
async def create_department(
    db: Db,
    _: TenantDeptManager,
    cid: CompanyId,
    body: TenantDepartmentCreateIn,
) -> TenantDepartmentOut:
    try:
        row = await create_tenant_department(db, cid, name=body.name, slug=body.slug)
        await db.commit()
        await db.refresh(row)
        return _out(row)
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e)) from e
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Department slug already exists") from None


@router.patch("/{department_id}", response_model=TenantDepartmentOut)
async def patch_department(
    department_id: str,
    db: Db,
    _: TenantDeptManager,
    cid: CompanyId,
    body: TenantDepartmentPatchIn,
) -> TenantDepartmentOut:
    try:
        row = await patch_tenant_department(db, cid, department_id, name=body.name)
        await db.commit()
        await db.refresh(row)
        return _out(row)
    except LookupError:
        await db.rollback()
        raise HTTPException(status_code=404, detail="Department not found") from None
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.delete("/{department_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_department(
    department_id: str,
    db: Db,
    _: TenantDeptManager,
    cid: CompanyId,
) -> None:
    try:
        await delete_tenant_department(db, cid, department_id)
        await db.commit()
    except LookupError:
        await db.rollback()
        raise HTTPException(status_code=404, detail="Department not found") from None
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e)) from e
