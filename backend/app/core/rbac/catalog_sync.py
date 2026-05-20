"""Runtime sync of `rbac_catalog_permissions` from the in-code RBAC catalog.

The consolidated Alembic baseline creates tables via metadata without seed rows.
Tenant role grants reference catalog keys with a foreign key, so inserts must be
preceded by an idempotent catalog sync (also used in tests and app startup).
"""

from __future__ import annotations

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac.catalog import (
    FEATURE_TO_RBAC_PERMISSIONS,
    RBAC_KEY_REQUIRES_COMPANY_FEATURE,
    RBAC_PERMISSION_SEED,
)
from app.core.rbac.module_manifest import TENANT_MODULE_SURFACES
from app.models.rbac_models import RbacCatalogPermission

_SEED_DESC: dict[str, str] = dict(RBAC_PERMISSION_SEED)


def _collect_static_permission_keys() -> set[str]:
    """Union of every permission key derivable from catalog + module surfaces."""
    keys: set[str] = set(_SEED_DESC.keys())
    for perms in FEATURE_TO_RBAC_PERMISSIONS.values():
        keys.update(perms)
    keys.update(RBAC_KEY_REQUIRES_COMPANY_FEATURE.keys())
    for surf in TENANT_MODULE_SURFACES:
        keys.update(surf.required_permissions)
    return keys


async def collect_all_permission_keys() -> set[str]:
    """Return all permission keys the application may insert into ``tenant_role_grants`` or enforce."""
    return _collect_static_permission_keys()


def _description_for_key(key: str) -> str | None:
    if key in _SEED_DESC:
        return _SEED_DESC[key]
    return "Application-managed RBAC permission"


async def sync_rbac_catalog_permissions(db: AsyncSession) -> None:
    """
    Upsert catalog rows for all known keys (INSERT … ON CONFLICT DO NOTHING).

    Does not commit — callers own transaction boundaries (tests use rollback;
    API routes / lifespan commit as needed).
    """
    keys = await collect_all_permission_keys()
    if not keys:
        return
    rows = [{"key": k, "description": _description_for_key(k)} for k in sorted(keys)]
    stmt = pg_insert(RbacCatalogPermission).values(rows)
    stmt = stmt.on_conflict_do_nothing(index_elements=["key"])
    await db.execute(stmt)
    await db.flush()
