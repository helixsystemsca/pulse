"""Tenant RLS session context and policy function tests."""

from __future__ import annotations

import pytest
from sqlalchemy import text

from app.core.security.tenant_rls import (
    apply_pulse_rls_context,
    apply_pulse_rls_system_context,
)


@pytest.mark.asyncio
async def test_pulse_rls_context_sets_gucs(db_session):
    await apply_pulse_rls_context(
        db_session,
        company_id="11111111-1111-1111-1111-111111111111",
        is_system_admin=False,
    )
    row = (
        await db_session.execute(
            text(
                "SELECT current_setting('pulse.company_id', true), "
                "current_setting('pulse.is_system_admin', true)"
            )
        )
    ).one()
    assert row[0] == "11111111-1111-1111-1111-111111111111"
    assert row[1] == "false"


@pytest.mark.asyncio
async def test_pulse_rls_system_admin_context(db_session):
    await apply_pulse_rls_system_context(db_session)
    row = (
        await db_session.execute(
            text("SELECT current_setting('pulse.is_system_admin', true)")
        )
    ).one()
    assert row[0] == "true"


@pytest.mark.asyncio
async def test_pulse_rls_policy_functions_exist(db_session):
    """Migration 1021 defines SQL helpers used by policies."""
    fn = (
        await db_session.execute(
            text("SELECT pulse_rls_tenant_visible('11111111-1111-1111-1111-111111111111'::uuid)")
        )
    ).scalar()
    assert fn is False


@pytest.mark.asyncio
async def test_cross_tenant_select_blocked_when_rls_enforced(db_session, tenant_seed):
    """
    Optional integration: set TEST_DATABASE_RLS_ROLE to a non-superuser role with SELECT on jobs.

    Superuser connections bypass RLS; this test documents expected behavior when enforced.
    """
    import os

    rls_role = os.environ.get("TEST_DATABASE_RLS_ROLE", "").strip()
    if not rls_role:
        pytest.skip("Set TEST_DATABASE_RLS_ROLE to exercise enforced RLS")

    other_company = "99999999-9999-9999-9999-999999999999"
    await db_session.execute(text(f"SET ROLE {rls_role}"))
    await apply_pulse_rls_context(db_session, company_id=tenant_seed.company_id, is_system_admin=False)
    count = (
        await db_session.execute(
            text("SELECT count(*) FROM jobs WHERE company_id = :cid"),
            {"cid": other_company},
        )
    ).scalar()
    assert int(count or 0) == 0
