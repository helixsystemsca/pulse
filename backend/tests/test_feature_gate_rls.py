"""FeatureGateMiddleware must set Pulse RLS GUCs on its own session.

Production (pulse_app + FORCE RLS): middleware opened AsyncSessionLocal without
pulse.company_id / pulse.is_system_admin, so Company / company_features were
invisible and every gated module returned 403 feature_disabled.
"""

from __future__ import annotations

import re
import uuid
from contextlib import asynccontextmanager

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.features.cache import clear_all
from app.core.features.service import FeatureFlagService
from app.core.security.tenant_rls import apply_pulse_rls_context
from app.models.domain import Company, User, UserRole


@asynccontextmanager
async def _pulse_app_style_role(db_session: AsyncSession):
    """Temporary NOBYPASSRLS role — same pattern as test_auth / PR #9."""
    role = "pulse_gate_" + uuid.uuid4().hex[:10]
    assert re.fullmatch(r"pulse_gate_[0-9a-f]+", role)
    await db_session.execute(text(f"CREATE ROLE {role} NOLOGIN NOBYPASSRLS NOSUPERUSER"))
    try:
        await db_session.execute(text(f"GRANT USAGE ON SCHEMA public TO {role}"))
        await db_session.execute(
            text(f"GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO {role}")
        )
        await db_session.execute(
            text(f"GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {role}")
        )
        await db_session.execute(text(f"GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO {role}"))
        await db_session.execute(text(f"SET ROLE {role}"))
        try:
            yield role
        finally:
            await db_session.execute(text("RESET ROLE"))
    finally:
        await db_session.execute(text("RESET ROLE"))
        await db_session.execute(text(f"REVOKE ALL ON ALL TABLES IN SCHEMA public FROM {role}"))
        await db_session.execute(text(f"REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM {role}"))
        await db_session.execute(text(f"REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM {role}"))
        await db_session.execute(text(f"REVOKE ALL ON SCHEMA public FROM {role}"))
        await db_session.execute(text(f"DROP ROLE IF EXISTS {role}"))


@pytest.mark.asyncio
async def test_feature_flags_hidden_until_tenant_guc(db_session: AsyncSession, seeded_tenant):
    cid = seeded_tenant.company_id
    clear_all()
    async with _pulse_app_style_role(db_session):
        hidden = await db_session.get(Company, cid)
        assert hidden is None

        svc = FeatureFlagService(db_session)
        assert await svc.any_enabled(cid, ("equipment", "inventory", "recreation_ops")) is False

        await apply_pulse_rls_context(db_session, company_id=cid, is_system_admin=False)
        clear_all()
        assert await svc.any_enabled(cid, ("equipment", "inventory", "recreation_ops")) is True


@pytest.mark.asyncio
async def test_feature_gate_allows_enabled_module_under_force_rls(
    client: AsyncClient, db_session: AsyncSession, seeded_tenant
):
    """Gated route must not 403 feature_disabled when the tenant has the module on."""
    from app.core.auth.security import create_access_token
    from app.core.company_features import sync_enabled_features
    from app.core.features.system_catalog import GLOBAL_SYSTEM_FEATURES

    await sync_enabled_features(db_session, seeded_tenant.company_id, list(GLOBAL_SYSTEM_FEATURES))
    admin = await db_session.get(User, seeded_tenant.manager_id)
    assert admin is not None
    admin.roles = [UserRole.company_admin.value]
    await db_session.flush()
    token = create_access_token(
        subject=admin.id,
        extra_claims={
            "company_id": seeded_tenant.company_id,
            "role": UserRole.company_admin.value,
            "tv": 0,
        },
    )
    clear_all()

    async with _pulse_app_style_role(db_session):
        r = await client.get(
            "/api/v1/recreation-ops/command/dashboard",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 200, r.text

        eq = await client.get(
            "/api/v1/equipment",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert eq.status_code == 200, eq.text

        inv = await client.get(
            "/api/inventory/contractors",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert inv.status_code == 200, inv.text
