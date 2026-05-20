"""Tenant RBAC introspection (company administrators, scoped tenant only)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_company_admin_scoped
from app.core.rbac.introspect import build_rbac_introspection
from app.models.domain import User
from app.schemas.rbac_introspection import RbacIntrospectionOut

router = APIRouter(prefix="/rbac", tags=["rbac"])


@router.get("/introspection", response_model=RbacIntrospectionOut)
async def rbac_introspection(
    admin: Annotated[User, Depends(require_company_admin_scoped)],
    db: Annotated[AsyncSession, Depends(get_db)],
    target_user_id: str | None = Query(
        default=None,
        description="Optional user id in the same company to inspect (defaults to the caller).",
    ),
) -> RbacIntrospectionOut:
    subject = admin
    if target_user_id and target_user_id != str(admin.id):
        q = await db.execute(select(User).where(User.id == target_user_id))
        target = q.scalar_one_or_none()
        if not target or str(target.company_id) != str(admin.company_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        subject = target
    raw = await build_rbac_introspection(db, subject)
    return RbacIntrospectionOut.from_introspect_dict(raw)
