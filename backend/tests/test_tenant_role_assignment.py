"""Tenant role persistence must precede user.tenant_role_id assignment."""

from __future__ import annotations

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tenant_roles import assign_user_tenant_role, create_or_fetch_tenant_role, ensure_baseline_tenant_roles
from app.models.domain import User
from app.models.rbac_models import TenantRole


@pytest.mark.asyncio
async def test_assign_user_tenant_role_after_role_persisted(db_session: AsyncSession, seeded_tenant) -> None:
    worker = await db_session.get(User, seeded_tenant.worker_id)
    assert worker is not None
    role = await create_or_fetch_tenant_role(
        db_session,
        seeded_tenant.company_id,
        slug="test_role",
        name="Test role",
        feature_keys=["monitoring"],
    )
    await assign_user_tenant_role(db_session, worker, role)

    q = await db_session.execute(select(TenantRole).where(TenantRole.id == role.id))
    assert q.scalar_one_or_none() is not None
    assert worker.tenant_role_id == role.id


@pytest.mark.asyncio
async def test_ensure_baseline_roles_idempotent(db_session: AsyncSession, seeded_tenant) -> None:
    first = await ensure_baseline_tenant_roles(db_session, seeded_tenant.company_id)
    second = await ensure_baseline_tenant_roles(db_session, seeded_tenant.company_id)
    assert first["worker"].id == second["worker"].id
    assert first["no_access"].id == second["no_access"].id
