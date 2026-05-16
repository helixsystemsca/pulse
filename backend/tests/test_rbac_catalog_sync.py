"""RBAC catalog sync: DB rows must exist before tenant_role_grants inserts."""

from __future__ import annotations

import pytest
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac.catalog_sync import collect_all_permission_keys, sync_rbac_catalog_permissions
from app.core.tenant_roles import ensure_baseline_tenant_roles
from app.models.rbac_models import RbacCatalogPermission


@pytest.mark.asyncio
async def test_catalog_sync_registers_all_permissions(db_session: AsyncSession) -> None:
    keys = await collect_all_permission_keys()
    assert keys
    await sync_rbac_catalog_permissions(db_session)
    res = await db_session.execute(select(func.count()).select_from(RbacCatalogPermission))
    count = int(res.scalar_one() or 0)
    assert count >= len(keys)
    for k in keys:
        row = await db_session.get(RbacCatalogPermission, k)
        assert row is not None, f"missing catalog row for {k!r}"


@pytest.mark.asyncio
async def test_catalog_sync_idempotent(db_session: AsyncSession) -> None:
    await sync_rbac_catalog_permissions(db_session)
    res1 = await db_session.execute(select(func.count()).select_from(RbacCatalogPermission))
    n1 = int(res1.scalar_one() or 0)
    await sync_rbac_catalog_permissions(db_session)
    res2 = await db_session.execute(select(func.count()).select_from(RbacCatalogPermission))
    n2 = int(res2.scalar_one() or 0)
    assert n1 == n2


@pytest.mark.asyncio
async def test_baseline_roles_do_not_fail_when_new_permissions_added(
    db_session: AsyncSession, seeded_tenant
) -> None:
    """Simulate an empty catalog (e.g. fresh create_all DB) then sync + baseline."""
    await db_session.execute(delete(RbacCatalogPermission))
    await db_session.flush()
    await sync_rbac_catalog_permissions(db_session)
    roles = await ensure_baseline_tenant_roles(db_session, seeded_tenant.company_id)
    assert roles["company_admin"].id
    assert roles["worker"].id
