"""Tenant company branding: logo + background uploads and optional external URLs."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from starlette.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_company_user, get_db, require_company_admin_scoped
from app.core.company_background_upload import INTERNAL_BACKGROUND_PATH
from app.core.company_logo_upload import INTERNAL_LOGO_PATH, normalize_logo_content_type, validate_logo_bytes
from app.core.pulse_storage import (
    read_company_background_bytes,
    read_company_logo_bytes,
    write_company_background_bytes,
    write_company_logo_bytes,
)
from app.models.domain import Company, User
from app.schemas.company import CompanyLogoUploadOut, CompanyProfilePatch

router = APIRouter(prefix="/company", tags=["company"])

_CACHE_PRIVATE = {"Cache-Control": "private, no-store"}


@router.get("/logo")
async def get_company_logo_file(
    user: Annotated[User, Depends(get_current_company_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    """Serve the uploaded logo for the authenticated user's company (Authorization required)."""
    cid = str(user.company_id)
    try:
        blob = await read_company_logo_bytes(cid)
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)) from e
    if not blob:
        co = await db.get(Company, cid)
        if co and (co.logo_url or "").strip() == INTERNAL_LOGO_PATH:
            co.logo_url = None
            await db.commit()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No uploaded logo")
    data, media_type = blob
    return Response(content=data, media_type=media_type, headers=_CACHE_PRIVATE)


@router.get("/background")
async def get_company_background_file(
    user: Annotated[User, Depends(get_current_company_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    cid = str(user.company_id)
    try:
        blob = await read_company_background_bytes(cid)
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)) from e
    if not blob:
        co = await db.get(Company, cid)
        if co and (co.background_image_url or "").strip() == INTERNAL_BACKGROUND_PATH:
            co.background_image_url = None
            await db.commit()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No uploaded background")
    data, media_type = blob
    return Response(content=data, media_type=media_type, headers=_CACHE_PRIVATE)


@router.post("/logo", response_model=CompanyLogoUploadOut)
async def upload_company_logo(
    user: Annotated[User, Depends(require_company_admin_scoped)],
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
) -> CompanyLogoUploadOut:
    ct = normalize_logo_content_type(file.content_type)
    raw = await file.read()
    try:
        ext = validate_logo_bytes(ct, raw)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e

    cid = str(user.company_id)
    try:
        await write_company_logo_bytes(cid, ext, ct, raw)
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)) from e

    co = await db.get(Company, cid)
    if not co:
        raise HTTPException(status_code=404, detail="Company not found")
    co.logo_url = INTERNAL_LOGO_PATH
    await db.commit()
    await db.refresh(co)

    return CompanyLogoUploadOut(
        logo_url=INTERNAL_LOGO_PATH,
        header_image_url=co.header_image_url,
        background_image_url=getattr(co, "background_image_url", None),
    )


@router.post("/background", response_model=CompanyLogoUploadOut)
async def upload_company_background(
    user: Annotated[User, Depends(require_company_admin_scoped)],
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
) -> CompanyLogoUploadOut:
    ct = normalize_logo_content_type(file.content_type)
    raw = await file.read()
    try:
        ext = validate_logo_bytes(ct, raw)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e

    cid = str(user.company_id)
    try:
        await write_company_background_bytes(cid, ext, ct, raw)
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)) from e

    co = await db.get(Company, cid)
    if not co:
        raise HTTPException(status_code=404, detail="Company not found")
    co.background_image_url = INTERNAL_BACKGROUND_PATH
    await db.commit()
    await db.refresh(co)
    return CompanyLogoUploadOut(
        logo_url=co.logo_url or "",
        header_image_url=co.header_image_url,
        background_image_url=INTERNAL_BACKGROUND_PATH,
        message="Background updated",
    )


@router.patch("/profile", response_model=CompanyLogoUploadOut)
async def patch_company_profile(
    body: CompanyProfilePatch,
    user: Annotated[User, Depends(require_company_admin_scoped)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CompanyLogoUploadOut:
    """Set `logo_url` to a public https URL, or null to clear (uploaded file may still exist)."""
    co = await db.get(Company, str(user.company_id))
    if not co:
        raise HTTPException(status_code=404, detail="Company not found")
    data = body.model_dump(exclude_unset=True)
    if "logo_url" in data:
        raw = data["logo_url"]
        if raw is None:
            co.logo_url = None
        else:
            co.logo_url = str(raw).strip() or None
    if "header_image_url" in data:
        raw = data["header_image_url"]
        if raw is None:
            co.header_image_url = None
        else:
            co.header_image_url = str(raw).strip() or None
    if "background_image_url" in data:
        raw = data["background_image_url"]
        if raw is None:
            co.background_image_url = None
        else:
            co.background_image_url = str(raw).strip() or None
    if "name" in data and data["name"] is not None:
        n = str(data["name"]).strip()
        if n:
            co.name = n
    if "timezone" in data:
        tz = data["timezone"]
        co.timezone = str(tz).strip() or None if tz is not None else None
    if "industry" in data:
        ind = data["industry"]
        co.industry = str(ind).strip() or None if ind is not None else None
    await db.commit()
    await db.refresh(co)
    return CompanyLogoUploadOut(
        logo_url=co.logo_url or "",
        header_image_url=co.header_image_url,
        background_image_url=getattr(co, "background_image_url", None),
        message="Company updated",
    )
