"""RBAC catalog sync: DB rows must exist before tenant_role_grants inserts."""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import delete, func, select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac.catalog_sync import collect_all_permission_keys, sync_rbac_catalog_permissions
from app.core.security.tenant_rls import apply_pulse_rls_context
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


@pytest.mark.asyncio
async def test_catalog_sync_restores_tenant_rls_context(
    db_session: AsyncSession, seeded_tenant
) -> None:
    await apply_pulse_rls_context(
        db_session, company_id=seeded_tenant.company_id, is_system_admin=False
    )
    await sync_rbac_catalog_permissions(db_session)
    row = (
        await db_session.execute(
            text(
                "SELECT current_setting('pulse.company_id', true), "
                "current_setting('pulse.is_system_admin', true)"
            )
        )
    ).one()
    assert row[0] == seeded_tenant.company_id
    assert row[1] == "false"


@pytest.mark.asyncio
async def test_catalog_write_as_nobyprlsrls_role_needs_system_context(
    db_session: AsyncSession,
) -> None:
    """pulse_app (NOBYPASSRLS) cannot insert catalog rows unless GUCs are set."""
    role = "pulse_cat_" + uuid.uuid4().hex[:10]
    await db_session.execute(text(f"CREATE ROLE {role} NOLOGIN NOBYPASSRLS NOSUPERUSER"))
    try:
        await db_session.execute(text(f"GRANT USAGE ON SCHEMA public TO {role}"))
        await db_session.execute(
            text(f"GRANT SELECT, INSERT, UPDATE ON TABLE rbac_catalog_permissions TO {role}")
        )
        await db_session.execute(text(f"GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO {role}"))
        await db_session.execute(text(f"SET ROLE {role}"))
        try:
            with pytest.raises(DBAPIError, match="row-level security"):
                async with db_session.begin_nested():
                    await db_session.execute(
                        text(
                            "INSERT INTO rbac_catalog_permissions (key, description) "
                            "VALUES ('test.rls.catalog_write', 'should fail')"
                        )
                    )
                    await db_session.flush()
            await sync_rbac_catalog_permissions(db_session)
            row = await db_session.get(RbacCatalogPermission, "test.rls.catalog_write")
            # Sync inserts known keys, not this probe key; probe insert failed as expected.
            assert row is None
            keys = await collect_all_permission_keys()
            sample = next(iter(keys))
            existing = await db_session.get(RbacCatalogPermission, sample)
            assert existing is not None
        finally:
            await db_session.execute(text("RESET ROLE"))
    finally:
        await db_session.execute(text("RESET ROLE"))
        await db_session.execute(text(f"REVOKE ALL ON TABLE rbac_catalog_permissions FROM {role}"))
        await db_session.execute(text(f"REVOKE ALL ON SCHEMA public FROM {role}"))
        await db_session.execute(
            text(f"REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM {role}")
        )
        await db_session.execute(text(f"DROP ROLE IF EXISTS {role}"))
