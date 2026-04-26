"""
backend/app/api/config_routes.py
════════════════════════════════════════════════════════════════════════════════
Unified config API. All modules read/write config through these endpoints.

Endpoints
----------
GET  /api/v1/config/{module}              — full module config (company + zone merged)
GET  /api/v1/config/{module}?zone_id=X   — with zone override applied
PATCH /api/v1/config/{module}             — update company-level config for a module
PATCH /api/v1/config/{module}?zone_id=X  — update zone override

GET  /api/v1/config/zones/{zone_id}/overrides   — all overrides set for a zone
DELETE /api/v1/config/zones/{zone_id}/{module}/{key} — remove one zone override

GET  /api/v1/config/all          — full config dump (all modules, company level)
GET  /api/v1/config/defaults     — platform defaults (no DB, no auth needed for UI hints)
"""

from __future__ import annotations

import logging
from typing import Annotated, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_company_admin
from app.core.user_roles import user_has_any_role
from app.models.domain import User, UserRole
from app.services.config_service import ConfigService, PLATFORM_DEFAULTS

log = logging.getLogger("pulse.config.routes")
router = APIRouter(prefix="/config", tags=["config"])

# ── Auth helpers ──────────────────────────────────────────────────────────────

async def _resolve_company_id(
    user: Annotated[User, Depends(get_current_user)],
    company_id: Optional[str] = Query(None),
) -> str:
    if user_has_any_role(user, UserRole.system_admin) or user.is_system_admin:
        if not company_id:
            raise HTTPException(400, "company_id required for system administrators")
        return company_id
    if not user.company_id:
        raise HTTPException(403, "Not a tenant user")
    cid = str(user.company_id)
    if company_id and company_id != cid:
        raise HTTPException(403, "Company access denied")
    return cid

CompanyId = Annotated[str, Depends(_resolve_company_id)]
Db        = Annotated[AsyncSession, Depends(get_db)]
AnyUser   = Annotated[User, Depends(get_current_user)]
Admin     = Annotated[User, Depends(require_company_admin)]

VALID_MODULES = set(PLATFORM_DEFAULTS.keys())


def _check_module(module: str) -> None:
    if module not in VALID_MODULES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Unknown module '{module}'. Valid: {sorted(VALID_MODULES)}",
        )

# ── Schemas ───────────────────────────────────────────────────────────────────

class ConfigPatchBody(BaseModel):
    """Key-value pairs to upsert. Omitted keys are unchanged."""
    values: dict[str, Any]


class ConfigOut(BaseModel):
    module:   str
    scope:    str      # "company" or "zone:{zone_id}"
    config:   dict[str, Any]
    defaults: dict[str, Any]


class ZoneOverridesOut(BaseModel):
    zone_id:   str
    overrides: dict[str, dict[str, Any]]   # {module: {key: value}}


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/defaults")
async def get_platform_defaults() -> dict[str, dict[str, Any]]:
    """
    Platform defaults for all modules. No auth required.
    Used by the frontend Settings UI to show reset values.
    """
    return ConfigService.all_platform_defaults()


@router.get("/all")
async def get_all_config(
    db: Db,
    _: AnyUser,
    cid: CompanyId,
) -> dict[str, dict[str, Any]]:
    """
    Full config dump for a company — all modules, company-level settings merged
    with platform defaults. Used on settings page load.
    """
    result = {}
    for module in PLATFORM_DEFAULTS:
        result[module] = await ConfigService.get_module(db, cid, module)
    return result


@router.get("/{module}", response_model=ConfigOut)
async def get_module_config(
    module: str,
    db: Db,
    _: AnyUser,
    cid: CompanyId,
    zone_id: Optional[str] = Query(None),
) -> ConfigOut:
    """Get full config for one module. Pass zone_id to apply zone overrides."""
    _check_module(module)
    config = await ConfigService.get_module(db, cid, module, zone_id=zone_id)
    return ConfigOut(
        module=module,
        scope=f"zone:{zone_id}" if zone_id else "company",
        config=config,
        defaults=PLATFORM_DEFAULTS.get(module, {}),
    )


@router.patch("/{module}", response_model=ConfigOut)
async def patch_module_config(
    module: str,
    body: ConfigPatchBody,
    db: Db,
    user: Admin,
    cid: CompanyId,
    zone_id: Optional[str] = Query(None),
) -> ConfigOut:
    """
    Update config values for a module.
    Pass zone_id to write a zone override instead of a company setting.
    Only keys in `values` are changed — omitted keys are untouched.
    """
    _check_module(module)

    if not body.values:
        raise HTTPException(400, "values must be a non-empty object")

    # Reject unknown keys to prevent silent typos
    module_defaults = PLATFORM_DEFAULTS.get(module, {})
    unknown = [k for k in body.values if k not in module_defaults]
    if unknown:
        raise HTTPException(
            400,
            f"Unknown config keys for module '{module}': {unknown}. "
            f"Valid keys: {sorted(module_defaults.keys())}",
        )

    await ConfigService.set_many(
        db, cid, module, body.values,
        zone_id=zone_id,
        updated_by=str(user.id),
        autocommit=True,
    )

    log.info(
        "config.patch company=%s module=%s zone=%s keys=%s by=%s",
        cid[:8], module, (zone_id or "")[:8], list(body.values.keys()), str(user.id)[:8],
    )

    config = await ConfigService.get_module(db, cid, module, zone_id=zone_id)
    return ConfigOut(
        module=module,
        scope=f"zone:{zone_id}" if zone_id else "company",
        config=config,
        defaults=PLATFORM_DEFAULTS.get(module, {}),
    )


@router.get("/zones/{zone_id}/overrides", response_model=ZoneOverridesOut)
async def get_zone_overrides(
    zone_id: str,
    db: Db,
    _: AnyUser,
    cid: CompanyId,
) -> ZoneOverridesOut:
    """All config overrides set for a specific zone."""
    overrides = await ConfigService.get_zone_overrides(db, cid, zone_id)
    return ZoneOverridesOut(zone_id=zone_id, overrides=overrides)


@router.delete("/zones/{zone_id}/{module}/{key}", status_code=204)
async def delete_zone_override(
    zone_id: str,
    module: str,
    key: str,
    db: Db,
    user: Admin,
    cid: CompanyId,
) -> None:
    """
    Remove a zone override for a specific key.
    The key falls back to the company setting or platform default.
    """
    _check_module(module)
    await ConfigService.delete(db, cid, module, key, zone_id=zone_id, autocommit=True)
    log.info(
        "config.delete_zone_override company=%s zone=%s module=%s key=%s by=%s",
        cid[:8], zone_id[:8], module, key, str(user.id)[:8],
    )
