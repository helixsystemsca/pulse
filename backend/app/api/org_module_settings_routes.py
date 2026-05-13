"""
Organization-wide module settings for Pulse feature pages (`/api/v1/org/module-settings`).
Readable by tenant users; PATCH requires company administrator (or system administrator).
"""

from __future__ import annotations

from typing import Annotated, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import uuid4

from app.api.deps import get_current_user, get_db, require_company_admin
from app.core.org_module_settings_merge import merge_org_module_settings
from app.core.user_roles import user_has_any_role
from app.models.domain import User, UserRole
from app.models.pulse_models import PulseOrgModuleSettings
from app.schemas.org_module_settings import OrgModuleSettingsOut, OrgModuleSettingsPatchIn
from app.services.schedule_facility_zones import (
    schedule_facility_plan_from_merged,
    sync_schedule_facility_zones,
)

router = APIRouter(prefix="/org/module-settings", tags=["org-module-settings"])


async def resolve_org_module_company_id(
    user: Annotated[User, Depends(get_current_user)],
    company_id: Optional[str] = Query(None),
) -> str:
    if user_has_any_role(user, UserRole.system_admin) or user.is_system_admin:
        if not company_id:
            raise HTTPException(status_code=400, detail="company_id is required for system administrators")
        return company_id
    if user.company_id is None:
        raise HTTPException(status_code=403, detail="Not a tenant user")
    cid = str(user.company_id)
    if company_id is not None and company_id != cid:
        raise HTTPException(status_code=403, detail="Company access denied")
    return cid


CompanyId = Annotated[str, Depends(resolve_org_module_company_id)]
Db = Annotated[AsyncSession, Depends(get_db)]


async def _require_org_settings_reader(user: Annotated[User, Depends(get_current_user)]) -> User:
    if user_has_any_role(user, UserRole.system_admin) or user.is_system_admin:
        return user
    if user.company_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a tenant user")
    if not user_has_any_role(
        user,
        UserRole.worker,
        UserRole.lead,
        UserRole.supervisor,
        UserRole.manager,
        UserRole.company_admin,
        UserRole.demo_viewer,
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
    return user


OrgReader = Annotated[User, Depends(_require_org_settings_reader)]


async def _get_row(db: AsyncSession, cid: str) -> Optional[PulseOrgModuleSettings]:
    q = await db.execute(select(PulseOrgModuleSettings).where(PulseOrgModuleSettings.company_id == cid))
    return q.scalar_one_or_none()


@router.get("", response_model=OrgModuleSettingsOut)
async def get_org_module_settings(db: Db, _: OrgReader, cid: CompanyId) -> OrgModuleSettingsOut:
    row = await _get_row(db, cid)
    return OrgModuleSettingsOut(settings=merge_org_module_settings(row.settings if row else None))


def _deep_merge_patch(a: dict[str, Any], b: dict[str, Any]) -> dict[str, Any]:
    out = dict(a)
    for k, v in b.items():
        if k in out and isinstance(out[k], dict) and isinstance(v, dict):
            out[k] = _deep_merge_patch(out[k], v)
        else:
            out[k] = v
    return out


@router.patch("", response_model=OrgModuleSettingsOut)
async def patch_org_module_settings(
    db: Db,
    _: Annotated[User, Depends(require_company_admin)],
    cid: CompanyId,
    body: OrgModuleSettingsPatchIn,
) -> OrgModuleSettingsOut:
    if not isinstance(body.settings, dict):
        raise HTTPException(status_code=400, detail="settings must be an object")
    row = await _get_row(db, cid)
    base = merge_org_module_settings(row.settings if row else None)
    merged = _deep_merge_patch(base, body.settings)

    if row:
        row.settings = merged
    else:
        db.add(
            PulseOrgModuleSettings(
                id=str(uuid4()),
                company_id=cid,
                settings=merged,
            )
        )
    fc, fnames = schedule_facility_plan_from_merged(merged)
    await sync_schedule_facility_zones(db, cid, fc, fnames)
    await db.commit()
    row2 = await _get_row(db, cid)
    return OrgModuleSettingsOut(settings=merge_org_module_settings(row2.settings if row2 else merged))

