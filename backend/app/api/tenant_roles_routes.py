"""Tenant role templates — feature toggles and user assignment."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.api.workers_routes import CompanyId, Db, RosterPageUser
from app.core.company_features import tenant_enabled_feature_names_with_legacy
from app.core.features.canonical_catalog import canonical_keys_from_contract
from app.core.features.system_catalog import coerce_legacy_feature_names
from app.core.tenant_roles import (
    all_canonical_feature_keys,
    count_users_with_role,
    get_tenant_role_in_company,
    list_tenant_roles,
    normalize_role_slug,
    role_to_dict,
    sync_tenant_role_grants,
)
from app.models.rbac_models import TenantRole
from app.schemas.tenant_roles import TenantRoleCreateIn, TenantRoleListOut, TenantRoleOut, TenantRolePatchIn

router = APIRouter(prefix="/workers/tenant-roles", tags=["tenant-roles"])


async def _contract_names(db, company_id: str) -> list[str]:
    raw = await tenant_enabled_feature_names_with_legacy(db, company_id)
    return coerce_legacy_feature_names(raw)


@router.get("", response_model=TenantRoleListOut)
async def list_roles(db: Db, _: RosterPageUser, cid: CompanyId) -> TenantRoleListOut:
    roles = await list_tenant_roles(db, cid)
    contract = await _contract_names(db, cid)
    contract_canonical = set(canonical_keys_from_contract(contract))
    items: list[TenantRoleOut] = []
    for r in roles:
        uc = await count_users_with_role(db, r.id)
        d = role_to_dict(r, user_count=uc)
        items.append(TenantRoleOut(**d))
    catalog = [k for k in all_canonical_feature_keys() if k in contract_canonical]
    return TenantRoleListOut(items=items, catalog_feature_keys=catalog)


@router.post("", response_model=TenantRoleOut, status_code=status.HTTP_201_CREATED)
async def create_role(
    db: Db,
    _: RosterPageUser,
    cid: CompanyId,
    body: TenantRoleCreateIn,
) -> TenantRoleOut:
    contract = await _contract_names(db, cid)
    contract_canonical = set(canonical_keys_from_contract(contract))
    fkeys = [k for k in body.feature_keys if k in contract_canonical]
    slug = body.slug or normalize_role_slug(body.name)
    role = TenantRole(
        company_id=cid,
        department_id=body.department_id,
        slug=slug,
        name=body.name.strip(),
        feature_keys=fkeys,
    )
    db.add(role)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Role slug already exists") from None
    await sync_tenant_role_grants(db, role, contract_names=contract)
    await db.commit()
    await db.refresh(role)
    return TenantRoleOut(**role_to_dict(role, user_count=0))


@router.patch("/{role_id}", response_model=TenantRoleOut)
async def patch_role(
    db: Db,
    _: RosterPageUser,
    cid: CompanyId,
    role_id: str,
    body: TenantRolePatchIn,
) -> TenantRoleOut:
    role = await get_tenant_role_in_company(db, cid, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    contract = await _contract_names(db, cid)
    contract_canonical = set(canonical_keys_from_contract(contract))
    data = body.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        role.name = str(data["name"]).strip()
    if "slug" in data and data["slug"] is not None:
        role.slug = data["slug"]
    if "department_id" in data:
        role.department_id = data["department_id"]
    if "feature_keys" in data and data["feature_keys"] is not None:
        role.feature_keys = [k for k in data["feature_keys"] if k in contract_canonical]
    try:
        await sync_tenant_role_grants(db, role, contract_names=contract)
        await db.commit()
        await db.refresh(role)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Role slug already exists") from None
    uc = await count_users_with_role(db, role.id)
    return TenantRoleOut(**role_to_dict(role, user_count=uc))


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    db: Db,
    _: RosterPageUser,
    cid: CompanyId,
    role_id: str,
) -> None:
    role = await get_tenant_role_in_company(db, cid, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    uc = await count_users_with_role(db, role.id)
    if uc > 0:
        raise HTTPException(status_code=400, detail="Remove users from this role before deleting")
    await db.delete(role)
    await db.commit()
