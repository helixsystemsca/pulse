"""Current-user profile: avatar, workforce operational role, optional company fields (admin)."""

from __future__ import annotations

from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_company_user, get_db
from app.core.company_logo_upload import normalize_logo_content_type
from app.core.config import get_settings
from app.core.user_avatar_upload import INTERNAL_AVATAR_PATH, validate_logo_bytes, write_user_avatar_file
from app.core.user_roles import user_has_any_role
from app.models.domain import Company, User, UserRole
from app.schemas.profile import ProfileAvatarUploadOut, ProfileSettingsPatch

router = APIRouter(prefix="/profile", tags=["profile"])


def _avatar_disk_path(user_id: str) -> Path:
    root = Path(get_settings().pulse_uploads_dir) / "user_avatars"
    root.mkdir(parents=True, exist_ok=True)
    for ext in (".png", ".jpg", ".jpeg", ".webp", ".gif"):
        p = root / f"{user_id}{ext}"
        if p.is_file():
            return p
    return root / f"{user_id}.png"


def _guess_media_type(path: Path) -> str:
    suf = path.suffix.lower()
    return {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
    }.get(suf, "application/octet-stream")


@router.get("/avatar")
async def get_my_avatar_file(
    user: Annotated[User, Depends(get_current_company_user)],
) -> FileResponse:
    uid = str(user.id)
    path = _avatar_disk_path(uid)
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No uploaded avatar")
    return FileResponse(path, media_type=_guess_media_type(path))


@router.post("/avatar", response_model=ProfileAvatarUploadOut)
async def upload_my_avatar(
    user: Annotated[User, Depends(get_current_company_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
) -> ProfileAvatarUploadOut:
    ct = normalize_logo_content_type(file.content_type)
    raw = await file.read()
    try:
        ext = validate_logo_bytes(ct, raw)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e

    uid = str(user.id)
    write_user_avatar_file(uid, ext, raw)
    q = await db.get(User, uid)
    if not q:
        raise HTTPException(status_code=404, detail="User not found")
    q.avatar_url = INTERNAL_AVATAR_PATH
    await db.commit()
    return ProfileAvatarUploadOut(avatar_url=INTERNAL_AVATAR_PATH)


@router.patch("/settings")
async def patch_my_profile_settings(
    body: ProfileSettingsPatch,
    user: Annotated[User, Depends(get_current_company_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    udata = body.model_dump(exclude_unset=True)

    if "full_name" in udata:
        v = udata["full_name"]
        user.full_name = str(v).strip() or None if v is not None else None
    if "job_title" in udata:
        v = udata["job_title"]
        user.job_title = str(v).strip() or None if v is not None else None
    if "operational_role" in udata:
        user.operational_role = udata["operational_role"]

    if body.company is not None:
        co_data = body.company.model_dump(exclude_unset=True)
        if co_data:
            if not user_has_any_role(user, UserRole.company_admin):
                raise HTTPException(status_code=403, detail="Company admin only")
            if not user.company_id:
                raise HTTPException(status_code=400, detail="No company")
            co = await db.get(Company, str(user.company_id))
            if not co:
                raise HTTPException(status_code=404, detail="Company not found")
            if "name" in co_data and co_data["name"] is not None:
                n = str(co_data["name"]).strip()
                if n:
                    co.name = n
            if "timezone" in co_data:
                tz = co_data["timezone"]
                co.timezone = str(tz).strip() or None if tz is not None else None
            if "industry" in co_data:
                ind = co_data["industry"]
                co.industry = str(ind).strip() or None if ind is not None else None

    await db.commit()
    return {"message": "Profile updated"}
