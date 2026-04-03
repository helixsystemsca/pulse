"""Tenant company branding: logo upload (file) and optional external logo URL."""

from __future__ import annotations

from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_company_user, get_db, require_company_admin_scoped
from app.core.config import get_settings
from app.models.domain import Company, User
from app.schemas.company import CompanyLogoUploadOut, CompanyProfilePatch

router = APIRouter(prefix="/company", tags=["company"])

INTERNAL_LOGO_PATH = "/api/v1/company/logo"
_MAX_BYTES = 2 * 1024 * 1024
_CT_EXT = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


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
    ct = (file.content_type or "").split(";")[0].strip().lower()
    if ct not in _CT_EXT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upload an image (JPEG, PNG, WebP, or GIF)",
        )
    raw = await file.read()
    if len(raw) > _MAX_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image too large (max 2MB)")

    cid = str(user.company_id)
    root = Path(get_settings().pulse_uploads_dir) / "company_logos"
    root.mkdir(parents=True, exist_ok=True)
    ext = _CT_EXT[ct]
    path = root / f"{cid}{ext}"
    for old in root.glob(f"{cid}.*"):
        if old != path:
            try:
                old.unlink()
            except OSError:
                pass
    path.write_bytes(raw)

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
    await db.commit()
    await db.refresh(co)
    return CompanyLogoUploadOut(logo_url=co.logo_url or "", header_image_url=co.header_image_url)
