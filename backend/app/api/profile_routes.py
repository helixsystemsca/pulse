"""Current-user profile: avatar, workforce operational role, optional company fields (admin)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_company_user, get_db
from app.core.company_logo_upload import normalize_logo_content_type
from app.core.user_avatar_upload import (
    INTERNAL_AVATAR_PATH,
    INTERNAL_AVATAR_PENDING_PATH,
    user_avatar_disk_path,
    user_avatar_pending_disk_path,
    user_avatar_media_type,
    validate_logo_bytes,
    write_user_avatar_file,
    write_user_avatar_pending_file,
)
from app.core.user_roles import user_has_any_role
from app.models.domain import AvatarStatus, Company, User, UserRole
from app.schemas.profile import ProfileAvatarUploadOut, ProfileSettingsPatch

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("/avatar")
async def get_my_avatar_file(
    user: Annotated[User, Depends(get_current_company_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> FileResponse:
    uid = str(user.id)
    path = user_avatar_disk_path(uid)
    if not path.is_file():
        row = await db.get(User, uid)
        if row and (row.avatar_url or "").strip() == INTERNAL_AVATAR_PATH:
            row.avatar_url = None
            row.avatar_pending_url = None
            await db.commit()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No uploaded avatar")
    return FileResponse(
        path,
        media_type=user_avatar_media_type(path),
        headers={"Cache-Control": "private, no-store"},
    )


@router.get("/avatar-pending")
async def get_my_avatar_pending_file(
    user: Annotated[User, Depends(get_current_company_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> FileResponse:
    uid = str(user.id)
    q = await db.get(User, uid)
    if not q or q.avatar_status != AvatarStatus.pending:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No pending avatar")
    path = user_avatar_pending_disk_path(uid)
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No pending avatar")
    return FileResponse(path, media_type=user_avatar_media_type(path))


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
    q = await db.get(User, uid)
    if not q:
        raise HTTPException(status_code=404, detail="User not found")

    # Make the new avatar immediately visible to teammates.
    write_user_avatar_file(uid, ext, raw)
    q.avatar_url = INTERNAL_AVATAR_PATH
    q.avatar_pending_url = None
    q.avatar_status = AvatarStatus.approved
    await db.commit()
    return ProfileAvatarUploadOut(avatar_url=INTERNAL_AVATAR_PATH, message="Avatar updated")


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
