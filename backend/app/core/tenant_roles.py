"""Tenant role CRUD and grant sync from canonical `feature_keys`."""

from __future__ import annotations

import re
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.features.canonical_catalog import (
    CANONICAL_PRODUCT_FEATURES,
    canonicalize_feature_keys,
    contract_keys_for_canonical,
)
from app.core.rbac.catalog import FEATURE_TO_RBAC_PERMISSIONS, RBAC_KEY_REQUIRES_COMPANY_FEATURE
from app.models.domain import User
from app.models.rbac_models import TenantRole, TenantRoleGrant

_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,94}$")


def normalize_role_slug(raw: str) -> str:
    s = raw.strip().lower().replace(" ", "_")
    s = re.sub(r"[^a-z0-9_-]+", "", s)
    if not s or not _SLUG_RE.match(s):
        raise ValueError("Invalid role slug")
    return s


def rbac_keys_for_canonical_features(
    feature_keys: list[str],
    *,
    contract_names: set[str],
) -> set[str]:
    """Map canonical role features → flat RBAC keys, filtered by tenant contract."""
    keys: set[str] = set()
    contract_canonical = set(canonicalize_feature_keys(contract_names))
    for feat in canonicalize_feature_keys(feature_keys):
        if feat not in contract_canonical:
            continue
        for contract_key in contract_keys_for_canonical([feat]):
            mapped = FEATURE_TO_RBAC_PERMISSIONS.get(contract_key) or FEATURE_TO_RBAC_PERMISSIONS.get(feat)
            if not mapped:
                continue
            for pk in mapped:
                req = RBAC_KEY_REQUIRES_COMPANY_FEATURE.get(pk)
                if req is None or req in contract_names:
                    keys.add(pk)
    return keys


async def sync_tenant_role_grants(
    db: AsyncSession,
    role: TenantRole,
    *,
    contract_names: list[str],
) -> None:
    contract_set = {str(x) for x in contract_names}
    fkeys = role.feature_keys if isinstance(role.feature_keys, list) else []
    perm_keys = rbac_keys_for_canonical_features([str(x) for x in fkeys], contract_names=contract_set)
    await db.execute(delete(TenantRoleGrant).where(TenantRoleGrant.tenant_role_id == role.id))
    for pk in sorted(perm_keys):
        db.add(TenantRoleGrant(tenant_role_id=role.id, permission_key=pk))


async def list_tenant_roles(db: AsyncSession, company_id: str) -> list[TenantRole]:
    q = await db.execute(
        select(TenantRole).where(TenantRole.company_id == company_id).order_by(TenantRole.name.asc())
    )
    return list(q.scalars().all())


async def get_tenant_role_in_company(db: AsyncSession, company_id: str, role_id: str) -> TenantRole | None:
    q = await db.execute(
        select(TenantRole).where(TenantRole.id == role_id, TenantRole.company_id == company_id)
    )
    return q.scalar_one_or_none()


async def count_users_with_role(db: AsyncSession, role_id: str) -> int:
    q = await db.execute(select(func.count()).select_from(User).where(User.tenant_role_id == role_id))
    return int(q.scalar_one() or 0)


def role_to_dict(role: TenantRole, *, user_count: int = 0) -> dict[str, Any]:
    fkeys = role.feature_keys if isinstance(role.feature_keys, list) else []
    return {
        "id": role.id,
        "company_id": role.company_id,
        "slug": role.slug,
        "name": role.name,
        "department_id": role.department_id,
        "feature_keys": canonicalize_feature_keys(str(x) for x in fkeys),
        "user_count": user_count,
        "created_at": role.created_at,
    }


def effective_features_from_role(
    role: TenantRole | None,
    *,
    contract_names: list[str],
) -> list[str]:
    if role is None:
        return []
    fkeys = role.feature_keys if isinstance(role.feature_keys, list) else []
    contract_canonical = set(canonicalize_feature_keys(contract_names))
    return sorted(set(canonicalize_feature_keys(str(x) for x in fkeys)) & contract_canonical)


def all_canonical_feature_keys() -> list[str]:
    return list(CANONICAL_PRODUCT_FEATURES)
