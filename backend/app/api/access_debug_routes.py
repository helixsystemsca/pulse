"""Admin-only deterministic access-resolution debugger."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_company_admin
from app.core import tenant_feature_access as tfa
from app.core.access_debugger import compute_access_resolution_debug
from app.core.company_features import tenant_enabled_feature_names_with_legacy
from app.models.domain import User, UserRole
from app.models.pulse_models import PulseWorkerHR
from app.models.rbac_models import TenantRole
from app.core.user_roles import user_has_any_role
from app.core.rbac_resolution_audit import debug_resolved_access
from app.schemas.access_debug import AccessResolutionDebugOut
from app.schemas.rbac_resolution_audit import ResolvedAccessAuditOut

router = APIRouter(prefix="/debug", tags=["access-debug"])


@router.get("/access/{user_id}", response_model=AccessResolutionDebugOut)
async def get_access_resolution_debug(
    user_id: str,
    actor: Annotated[User, Depends(require_company_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AccessResolutionDebugOut:
    """
    Exact production resolution snapshot for ``user_id``.

    Authorized: system admins (any tenant) or tenant ``company_admin`` / facility delegates (same company only).
    """
    q = await db.execute(select(User).where(User.id == user_id))
    target = q.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOTFOUND, detail="User not found")

    is_platform = bool(actor.is_system_admin or user_has_any_role(actor, UserRole.system_admin))
    if not is_platform:
        if actor.company_id is None or target.company_id is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No company scope")
        if str(actor.company_id) != str(target.company_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User not in your company")

    if target.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target has no company_id — nothing to resolve",
        )

    cid = str(target.company_id)
    raw_contract = await tenant_enabled_feature_names_with_legacy(db, cid)
    contract = tfa._contract_feature_names_normalized(raw_contract)
    merged = await tfa.load_merged_workers_settings(db, cid)

    hr_me = (
        (
            await db.execute(select(PulseWorkerHR).where(PulseWorkerHR.user_id == target.id))
        ).scalar_one_or_none()
    )

    tenant_role: TenantRole | None = None
    tr_id = getattr(target, "tenant_role_id", None)
    if tr_id:
        tr_row = await db.execute(
            select(TenantRole).where(TenantRole.id == str(tr_id), TenantRole.company_id == cid)
        )
        tenant_role = tr_row.scalar_one_or_none()

    dbg = await compute_access_resolution_debug(
        db=db,
        target=target,
        contract_normalized=contract,
        merged_settings=merged,
        hr_row=hr_me,
        tenant_role=tenant_role,
    )
    return AccessResolutionDebugOut.model_validate(dbg.as_json())


@router.get("/access/{user_id}/resolved", response_model=ResolvedAccessAuditOut)
async def get_resolved_access_audit(
    user_id: str,
    actor: Annotated[User, Depends(require_company_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
    department: str | None = None,
) -> ResolvedAccessAuditOut:
    """
    Full-stack audit: matrix/contract debugger + per-feature sidebar/route/API/render simulation.

    Optional ``department`` query (e.g. ``communications``) adds workspace hub context.
    """
    q = await db.execute(select(User).where(User.id == user_id))
    target = q.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    is_platform = bool(actor.is_system_admin or user_has_any_role(actor, UserRole.system_admin))
    if not is_platform:
        if actor.company_id is None or target.company_id is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No company scope")
        if str(actor.company_id) != str(target.company_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User not in your company")

    if target.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target has no company_id — nothing to resolve",
        )

    cid = str(target.company_id)
    raw_contract = await tenant_enabled_feature_names_with_legacy(db, cid)
    contract = tfa._contract_feature_names_normalized(raw_contract)
    merged = await tfa.load_merged_workers_settings(db, cid)

    hr_me = (
        await db.execute(select(PulseWorkerHR).where(PulseWorkerHR.user_id == target.id))
    ).scalar_one_or_none()

    tenant_role: TenantRole | None = None
    tr_id = getattr(target, "tenant_role_id", None)
    if tr_id:
        tr_row = await db.execute(
            select(TenantRole).where(TenantRole.id == str(tr_id), TenantRole.company_id == cid)
        )
        tenant_role = tr_row.scalar_one_or_none()

    payload = await debug_resolved_access(
        db=db,
        target=target,
        contract_normalized=contract,
        merged_settings=merged,
        hr_row=hr_me,
        tenant_role=tenant_role,
        department_slug=department,
    )
    return ResolvedAccessAuditOut.model_validate(payload)
