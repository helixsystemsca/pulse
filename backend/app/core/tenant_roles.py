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


async def get_tenant_role_by_slug(db: AsyncSession, company_id: str, slug: str) -> TenantRole | None:
    norm = normalize_role_slug(slug)
    q = await db.execute(
        select(TenantRole).where(TenantRole.company_id == company_id, TenantRole.slug == norm)
    )
    return q.scalar_one_or_none()


async def get_tenant_role_in_company(db: AsyncSession, company_id: str, role_id: str) -> TenantRole | None:
    q = await db.execute(
        select(TenantRole).where(TenantRole.id == role_id, TenantRole.company_id == company_id)
    )
    return q.scalar_one_or_none()


async def create_or_fetch_tenant_role(
    db: AsyncSession,
    company_id: str,
    *,
    slug: str,
    name: str,
    feature_keys: list[str] | None = None,
    contract_names: list[str] | None = None,
) -> TenantRole:
    """
    Persist a tenant role (flush) and sync grants. Reuses an existing row when ``slug`` matches.
    """
    from app.core.company_features import tenant_enabled_feature_names_with_legacy
    from app.core.features.system_catalog import coerce_legacy_feature_names

    norm_slug = normalize_role_slug(slug)
    existing = await get_tenant_role_by_slug(db, company_id, norm_slug)
    fkeys = canonicalize_feature_keys(feature_keys or [])
    if contract_names is None:
        raw = await tenant_enabled_feature_names_with_legacy(db, company_id)
        contract_names = coerce_legacy_feature_names(raw)
    if existing is not None:
        existing.name = name.strip()
        existing.feature_keys = fkeys
        await sync_tenant_role_grants(db, existing, contract_names=contract_names)
        await db.flush()
        return existing

    role = TenantRole(
        company_id=company_id,
        slug=norm_slug,
        name=name.strip(),
        feature_keys=fkeys,
    )
    db.add(role)
    await db.flush()
    await sync_tenant_role_grants(db, role, contract_names=contract_names)
    await db.flush()
    return role


async def assign_user_tenant_role(db: AsyncSession, user: User, role: TenantRole) -> None:
    """Assign ``role`` to ``user`` only after the role row is persisted in this session."""
    if user.company_id is None or str(user.company_id) != str(role.company_id):
        raise ValueError("tenant role company_id must match user.company_id")
    persisted = await get_tenant_role_in_company(db, str(role.company_id), str(role.id))
    if persisted is None:
        raise ValueError("tenant role must be flushed before assigning to a user")
    user.tenant_role_id = str(role.id)
    await db.flush()


# Baseline role slugs created per company (Team Management / tests).
BASELINE_TENANT_ROLE_SLUGS: tuple[str, ...] = (
    "company_admin",
    "manager",
    "worker",
    "no_access",
)


async def ensure_baseline_tenant_roles(
    db: AsyncSession,
    company_id: str,
    *,
    contract_names: list[str] | None = None,
) -> dict[str, TenantRole]:
    """
    Ensure default tenant role templates exist for a company.

    - ``company_admin`` / ``manager``: full contract (canonical keys).
    - ``worker``: full contract (typical frontline default).
    - ``no_access``: empty feature set (explicit deny tests).
    """
    from app.core.company_features import tenant_enabled_feature_names_with_legacy
    from app.core.features.system_catalog import coerce_legacy_feature_names

    if contract_names is None:
        raw = await tenant_enabled_feature_names_with_legacy(db, company_id)
        contract_names = coerce_legacy_feature_names(raw)
    contract_canonical = canonicalize_feature_keys(contract_names)
    full = list(contract_canonical)

    roles = {
        "company_admin": await create_or_fetch_tenant_role(
            db,
            company_id,
            slug="company_admin",
            name="Company admin",
            feature_keys=full,
            contract_names=contract_names,
        ),
        "manager": await create_or_fetch_tenant_role(
            db,
            company_id,
            slug="manager",
            name="Manager",
            feature_keys=full,
            contract_names=contract_names,
        ),
        "worker": await create_or_fetch_tenant_role(
            db,
            company_id,
            slug="worker",
            name="Worker",
            feature_keys=full,
            contract_names=contract_names,
        ),
        "no_access": await create_or_fetch_tenant_role(
            db,
            company_id,
            slug="no_access",
            name="No access",
            feature_keys=[],
            contract_names=contract_names,
        ),
    }
    return roles


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
