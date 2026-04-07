"""Tenant company branding: logo upload (file) and optional external logo URL."""

from __future__ import annotations

from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_company_user, get_db, require_company_admin_scoped
from app.core.company_logo_upload import (
    INTERNAL_LOGO_PATH,
    normalize_logo_content_type,
    validate_logo_bytes,
    write_company_logo_file,
)
from app.core.config import get_settings
from app.models.domain import Company, User
from app.schemas.company import CompanyLogoUploadOut, CompanyProfilePatch

router = APIRouter(prefix="/company", tags=["company"])


def _logo_disk_path(company_id: str) -> Path:
    root = Path(get_settings().pulse_uploads_dir) / "company_logos"
    root.mkdir(parents=True, exist_ok=True)
    for ext in (".png", ".jpg", ".jpeg", ".webp", ".gif"):
        p = root / f"{company_id}{ext}"
        if p.is_file():
            return p
    return root / f"{company_id}.png"


def _guess_media_type(path: Path) -> str:
    suf = path.suffix.lower()
    return {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
    }.get(suf, "application/octet-stream")


@router.get("/logo")
async def get_company_logo_file(
    user: Annotated[User, Depends(get_current_company_user)],
) -> FileResponse:
    """Serve the uploaded logo for the authenticated user's company (Authorization required)."""
    cid = str(user.company_id)
    path = _logo_disk_path(cid)
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No uploaded logo")
    return FileResponse(path, media_type=_guess_media_type(path))


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
    write_company_logo_file(cid, ext, raw)

    co = await db.get(Company, cid)
    if not co:
        raise HTTPException(status_code=404, detail="Company not found")
    co.logo_url = INTERNAL_LOGO_PATH
    await db.commit()
    await db.refresh(co)

    return CompanyLogoUploadOut(logo_url=INTERNAL_LOGO_PATH, header_image_url=co.header_image_url)


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
    return CompanyLogoUploadOut(logo_url=co.logo_url or "", header_image_url=co.header_image_url)
