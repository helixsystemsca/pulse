"""Current-user profile: avatar, workforce operational role, optional company fields (admin)."""

from __future__ import annotations

import logging
from urllib.parse import urlparse
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from starlette.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_company_user, get_db
from app.core.company_logo_upload import normalize_logo_content_type
from app.core.supabase_storage import create_signed_upload_url, public_object_url
from app.core.pulse_storage import (
    read_user_avatar_bytes,
    read_user_avatar_pending_bytes,
    stored_object_display_url,
    write_user_avatar_bytes,
)
from app.core.audit.security_events import record_security_event
from app.limiter import limiter
from app.core.auth.security import bump_access_token_version, hash_password, verify_password
from app.core.user_avatar_upload import INTERNAL_AVATAR_PATH, validate_avatar_bytes
from app.core.user_roles import user_has_any_role
from app.models.domain import AvatarStatus, Company, User, UserRole
from app.schemas.profile import (
    ChangePasswordBody,
    ProfileAvatarSignedUploadOut,
    ProfileAvatarUploadOut,
    ProfileSettingsPatch,
)

router = APIRouter(prefix="/profile", tags=["profile"])

_log = logging.getLogger(__name__)

_AVATAR_BUCKET = "avatars"


@router.get("/avatar")
async def get_my_avatar_file(
    request: Request,
    user: Annotated[User, Depends(get_current_company_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    uid = str(user.id)
    row = await db.get(User, uid)
    storage_key = getattr(row, "avatar_storage_key", None) if row else None
    origin = (request.headers.get("origin") or "").strip()
    _log.info(
        "avatar_get start user_id=%s storage_key=%s origin=%s",
        uid,
        storage_key or "(legacy)",
        origin[:120] if origin else "(none)",
    )
    try:
        blob = await read_user_avatar_bytes(uid, storage_key=storage_key)
    except RuntimeError as e:
        _log.warning(
            "avatar_get storage_unavailable user_id=%s storage_key=%s detail=%s",
            uid,
            storage_key or "(legacy)",
            e,
        )
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)) from e
    except Exception as e:
        _log.exception(
            "avatar_get storage_error user_id=%s storage_key=%s",
            uid,
            storage_key or "(legacy)",
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Avatar storage unavailable",
        ) from e
    if not blob:
        if row and ((row.avatar_url or "").strip() == INTERNAL_AVATAR_PATH or row.avatar_storage_key):
            _log.info("avatar_get missing_bytes_clearing_stale_refs user_id=%s storage_key=%s", uid, storage_key)
            row.avatar_url = None
            row.avatar_storage_key = None
            row.avatar_pending_url = None
            await db.commit()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No uploaded avatar")
    data, media_type = blob
    _log.info(
        "avatar_get ok user_id=%s bytes=%d content_type=%s",
        uid,
        len(data),
        media_type,
    )
    return Response(content=data, media_type=media_type, headers={"Cache-Control": "private, no-store"})


@router.get("/avatar-pending")
async def get_my_avatar_pending_file(
    user: Annotated[User, Depends(get_current_company_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    uid = str(user.id)
    q = await db.get(User, uid)
    if not q or q.avatar_status != AvatarStatus.pending:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No pending avatar")
    try:
        blob = await read_user_avatar_pending_bytes(
            uid, storage_key=getattr(q, "avatar_pending_storage_key", None) if q else None
        )
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)) from e
    if not blob:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No pending avatar")
    data, media_type = blob
    return Response(content=data, media_type=media_type, headers={"Cache-Control": "private, no-store"})


@router.post("/avatar", response_model=ProfileAvatarUploadOut)
async def upload_my_avatar(
    user: Annotated[User, Depends(get_current_company_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
) -> ProfileAvatarUploadOut:
    ct = normalize_logo_content_type(file.content_type)
    raw = await file.read()
    try:
        ext = validate_avatar_bytes(ct, raw)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e

    uid = str(user.id)
    q = await db.get(User, uid)
    if not q:
        raise HTTPException(status_code=404, detail="User not found")

    if user.company_id is None:
        raise HTTPException(status_code=400, detail="User has no company")

    # Make the new avatar immediately visible to teammates.
    try:
        stored = await write_user_avatar_bytes(
            str(user.company_id),
            uid,
            ext,
            raw=raw,
            content_type=ct,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)) from e
    q.avatar_storage_key = stored.object_key
    q.avatar_url = stored_object_display_url(stored, INTERNAL_AVATAR_PATH)
    q.avatar_pending_url = None
    q.avatar_pending_storage_key = None
    q.avatar_status = AvatarStatus.approved
    await db.commit()
    return ProfileAvatarUploadOut(avatar_url=q.avatar_url or INTERNAL_AVATAR_PATH, message="Avatar updated")


@router.post("/avatar/signed-upload", response_model=ProfileAvatarSignedUploadOut)
async def create_my_avatar_signed_upload(
    user: Annotated[User, Depends(get_current_company_user)],
) -> ProfileAvatarSignedUploadOut:
    """
    Create a short-lived signed upload URL for the current user's avatar.

    The client uploads directly to Supabase Storage at `avatars/{userId}/profile.webp`, overwriting existing content.
    """
    uid = str(user.id)
    path = f"{uid}/profile.webp"
    signed = await create_signed_upload_url(_AVATAR_BUCKET, path, expires_in=600, upsert=True)
    public_url = public_object_url(_AVATAR_BUCKET, signed.path)
    return ProfileAvatarSignedUploadOut(
        bucket=_AVATAR_BUCKET,
        path=signed.path,
        token=signed.token,
        signed_url=signed.signed_url,
        public_url=public_url,
    )


def _avatar_url_safe_for_user(uid: str, url: str) -> bool:
    s = (url or "").strip()
    if not s:
        return False
    low = s.lower()
    if low.startswith("http://") or low.startswith("https://"):
        try:
            parsed = urlparse(s)
        except Exception:
            return False
        # Basic sanity: must end in /{uid}/profile.webp ignoring query.
        path = (parsed.path or "").rstrip("/")
        return path.endswith(f"/{uid}/profile.webp")
    # Allow internal legacy storage path.
    return s == INTERNAL_AVATAR_PATH


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
    if "avatar_url" in udata:
        v = udata["avatar_url"]
        if v is None:
            user.avatar_url = None
        else:
            s = str(v).strip()
            if not s:
                user.avatar_url = None
            elif not _avatar_url_safe_for_user(str(user.id), s):
                raise HTTPException(status_code=400, detail="Invalid avatar_url")
            else:
                user.avatar_url = s

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


@router.post("/password")
@limiter.limit("8/minute")
async def change_my_password(
    request: Request,
    body: ChangePasswordBody,
    user: Annotated[User, Depends(get_current_company_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    if not user.hashed_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password is not set for this account")
    if body.current_password == body.new_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password must be different")
    if not verify_password(body.current_password, user.hashed_password):
        rid = getattr(request.state, "request_id", None)
        await record_security_event(
            db,
            action="auth.password_change_failed",
            actor_user_id=str(user.id),
            company_id=str(user.company_id) if user.company_id else None,
            metadata={"reason": "bad_current_password"},
            request_id=rid,
        )
        await db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid current password")
    if not body.new_password.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password is required")
    user.hashed_password = hash_password(body.new_password)
    bump_access_token_version(user)
    rid = getattr(request.state, "request_id", None)
    await record_security_event(
        db,
        action="auth.password_changed",
        actor_user_id=str(user.id),
        company_id=str(user.company_id) if user.company_id else None,
        request_id=rid,
    )
    await db.commit()
    return {"message": "Password updated"}
