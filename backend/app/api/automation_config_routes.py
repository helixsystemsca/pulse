"""Tenant automation feature parameters under `/api/v1/feature-configs` (config toggles only)."""

from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_manager_or_above
from app.models.domain import User, UserRole
from app.schemas.automation_config import FeatureConfigPatchIn, FeatureConfigsOut
from app.services.automation.config_service import list_merged_all_configs, upsert_patch_feature_config

router = APIRouter(tags=["automation-config"])


async def resolve_feature_config_company_id(
    user: Annotated[User, Depends(require_manager_or_above)],
    company_id: Optional[str] = Query(None, description="Required for system administrators"),
) -> str:
    if user.role == UserRole.system_admin or user.is_system_admin:
        if not company_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="company_id is required for system administrators",
            )
        return company_id
    if user.company_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a tenant user")
    cid = str(user.company_id)
    if company_id is not None and company_id != cid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Company access denied")
    return cid


CompanyId = Annotated[str, Depends(resolve_feature_config_company_id)]
Db = Annotated[AsyncSession, Depends(get_db)]


@router.get("/feature-configs", response_model=FeatureConfigsOut)
async def get_feature_configs(
    db: Db,
    company_id: CompanyId,
) -> FeatureConfigsOut:
    merged = await list_merged_all_configs(db, company_id)
    return FeatureConfigsOut(features=merged)


@router.patch("/feature-configs/{feature_name}", response_model=FeatureConfigsOut)
async def patch_feature_config(
    feature_name: str,
    body: FeatureConfigPatchIn,
    db: Db,
    company_id: CompanyId,
) -> FeatureConfigsOut:
    try:
        await upsert_patch_feature_config(
            db,
            company_id,
            feature_name.strip(),
            enabled=body.enabled,
            config_patch=body.config,
        )
        await db.commit()
    except LookupError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="unknown feature name") from None
    merged = await list_merged_all_configs(db, company_id)
    return FeatureConfigsOut(features=merged)
