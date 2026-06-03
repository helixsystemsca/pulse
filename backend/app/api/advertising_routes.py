"""Arena advertising wall plans — `/api/advertising/walls`."""

from __future__ import annotations

from copy import deepcopy
from typing import Annotated, Any
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import Response

from app.api.deps import get_current_company_user, get_db
from app.core.org_module_settings_merge import merge_org_module_settings
from app.core.spatial_media_storage import (
    advertising_backdrop_proxy_path,
    read_advertising_wall_backdrop,
    upload_advertising_wall_backdrop,
)
from app.models.domain import User
from app.models.pulse_models import PulseOrgModuleSettings
from app.schemas.advertising_walls import (
    AdvertisingBackdropUploadOut,
    AdvertisingWallPlanOut,
    AdvertisingWallsOut,
    AdvertisingWallsPutIn,
)

router = APIRouter(prefix="/advertising", tags=["advertising"])

Db = Annotated[AsyncSession, Depends(get_db)]
TenantUser = Annotated[User, Depends(get_current_company_user)]

_MAX_WALLS = 64


async def _settings_row(db: AsyncSession, company_id: str) -> PulseOrgModuleSettings | None:
    q = await db.execute(select(PulseOrgModuleSettings).where(PulseOrgModuleSettings.company_id == company_id))
    return q.scalar_one_or_none()


def _strip_backdrop_blob(wall: dict[str, Any]) -> dict[str, Any]:
    out = dict(wall)
    url = out.get("backdropUrl")
    if isinstance(url, str) and url.startswith("data:"):
        out.pop("backdropUrl", None)
        out.pop("backdropNaturalWidth", None)
        out.pop("backdropNaturalHeight", None)
    return out


def _load_walls(stored: dict[str, Any] | None) -> list[dict[str, Any]]:
    merged = merge_org_module_settings(stored)
    raw = merged.get("advertising")
    if not isinstance(raw, dict):
        return []
    walls = raw.get("walls")
    if not isinstance(walls, list):
        return []
    return [w for w in walls if isinstance(w, dict)]


async def _save_walls(db: AsyncSession, company_id: str, walls: list[dict[str, Any]]) -> None:
    row = await _settings_row(db, company_id)
    base = merge_org_module_settings(row.settings if row else None)
    next_settings = deepcopy(base)
    adv = dict(next_settings.get("advertising") or {})
    adv["walls"] = [_strip_backdrop_blob(w) for w in walls[:_MAX_WALLS]]
    next_settings["advertising"] = adv
    if row:
        row.settings = next_settings
    else:
        db.add(PulseOrgModuleSettings(id=str(uuid4()), company_id=company_id, settings=next_settings))


async def _wall_out(company_id: str, wall: dict[str, Any]) -> AdvertisingWallPlanOut:
    wid = str(wall.get("id") or "")
    out = dict(wall)
    blob = await read_advertising_wall_backdrop(company_id, wid) if wid else None
    if blob:
        out["backdropUrl"] = advertising_backdrop_proxy_path(wid)
    elif isinstance(out.get("backdropUrl"), str) and out["backdropUrl"].startswith("data:"):
        out.pop("backdropUrl", None)
    return AdvertisingWallPlanOut.model_validate(out)


@router.get("/walls", response_model=AdvertisingWallsOut)
async def list_advertising_walls(db: Db, user: TenantUser) -> AdvertisingWallsOut:
    cid = str(user.company_id)
    row = await _settings_row(db, cid)
    walls = _load_walls(row.settings if row else None)
    items: list[AdvertisingWallPlanOut] = []
    for w in walls:
        try:
            items.append(await _wall_out(cid, w))
        except ValueError:
            continue
    return AdvertisingWallsOut(walls=items)


@router.put("/walls", response_model=AdvertisingWallsOut)
async def save_advertising_walls(body: AdvertisingWallsPutIn, db: Db, user: TenantUser) -> AdvertisingWallsOut:
    cid = str(user.company_id)
    if len(body.walls) > _MAX_WALLS:
        raise HTTPException(status_code=400, detail="Too many wall views (max 64)")
    cleaned: list[dict[str, Any]] = []
    for w in body.walls:
        if not isinstance(w, dict) or not str(w.get("id") or "").strip():
            raise HTTPException(status_code=400, detail="Each wall requires an id")
        cleaned.append(_strip_backdrop_blob(w))
    await _save_walls(db, cid, cleaned)
    await db.commit()
    items: list[AdvertisingWallPlanOut] = []
    for w in cleaned:
        items.append(await _wall_out(cid, w))
    return AdvertisingWallsOut(walls=items)


@router.post("/walls/{wall_id}/backdrop", response_model=AdvertisingBackdropUploadOut)
async def upload_wall_backdrop(
    wall_id: str,
    db: Db,
    user: TenantUser,
    file: UploadFile = File(...),
) -> AdvertisingBackdropUploadOut:
    cid = str(user.company_id)
    row = await _settings_row(db, cid)
    walls = _load_walls(row.settings if row else None)
    if not any(str(w.get("id")) == wall_id for w in walls):
        raise HTTPException(status_code=404, detail="Wall not found")
    content_type = (file.content_type or "image/jpeg").split(";")[0].strip().lower()
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Image file required")
    raw = await file.read()
    if not raw or len(raw) > 12 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 12MB)")
    ext = {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/webp": ".webp",
        "image/gif": ".gif",
    }.get(content_type, ".jpg")
    proxy = await upload_advertising_wall_backdrop(
        cid,
        wall_id,
        raw=raw,
        content_type=content_type,
        ext_with_dot=ext,
    )
    return AdvertisingBackdropUploadOut(backdrop_url=proxy)


@router.get("/walls/{wall_id}/backdrop")
async def get_wall_backdrop(wall_id: str, user: TenantUser) -> Response:
    cid = str(user.company_id)
    blob = await read_advertising_wall_backdrop(cid, wall_id)
    if not blob:
        raise HTTPException(status_code=404, detail="Backdrop not found")
    raw, media_type = blob
    return Response(content=raw, media_type=media_type, headers={"Cache-Control": "private, max-age=3600"})
