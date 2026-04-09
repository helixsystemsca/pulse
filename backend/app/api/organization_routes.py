"""Organization settings: branding + theme for current tenant."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_company_user, get_db, require_company_admin_scoped
from app.models.domain import Company, User
from app.schemas.organization import OrganizationOut

router = APIRouter(prefix="/organization", tags=["organization"])


@router.get("", response_model=OrganizationOut)
async def get_my_organization(
    user: Annotated[User, Depends(get_current_company_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OrganizationOut:
    if not user.company_id:
        raise HTTPException(status_code=404, detail="No organization")
    co = await db.get(Company, str(user.company_id))
    if not co:
        raise HTTPException(status_code=404, detail="Organization not found")
    bg = getattr(co, "background_image_url", None) or co.header_image_url
    return OrganizationOut(
        id=str(co.id),
        name=co.name,
        logo_url=co.logo_url,
        background_image_url=bg,
        theme=dict(getattr(co, "theme", None) or {}),
    )


@router.patch("", response_model=OrganizationOut)
async def patch_my_organization(
    body: dict[str, Any],
    user: Annotated[User, Depends(require_company_admin_scoped)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OrganizationOut:
    co = await db.get(Company, str(user.company_id))
    if not co:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Minimal, forward-compatible patch surface.
    if "name" in body and body["name"] is not None:
        n = str(body["name"]).strip()
        if n:
            co.name = n
    if "background_image_url" in body:
        raw = body["background_image_url"]
        co.background_image_url = str(raw).strip() or None if raw is not None else None
    if "theme" in body:
        raw = body["theme"]
        if raw is None:
            co.theme = {}
        elif isinstance(raw, dict):
            co.theme = raw
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="theme must be an object")

    await db.commit()
    await db.refresh(co)
    bg = getattr(co, "background_image_url", None) or co.header_image_url
    return OrganizationOut(
        id=str(co.id),
        name=co.name,
        logo_url=co.logo_url,
        background_image_url=bg,
        theme=dict(getattr(co, "theme", None) or {}),
    )

