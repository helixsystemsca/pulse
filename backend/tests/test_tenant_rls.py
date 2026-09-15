"""Tenant RLS session context and policy function tests."""

from __future__ import annotations

import os
import re
import uuid

import pytest
from sqlalchemy import text

from app.core.security.tenant_rls import (
    apply_pulse_rls_context,
    apply_pulse_rls_system_context,
)

_TENANT_A = "11111111-1111-1111-1111-111111111111"
_TENANT_B = "99999999-9999-9999-9999-999999999999"

_PHASE3_TABLES = (
    "companies",
    "alembic_version",
    "user_refresh_sessions",
    "material_request_draft_items",
    "purchasing_quick_purchase_lines",
    "ops_people",
    "ops_facilities",
    "ops_checklist_templates",
    "planner_tasks",
    "roadmap_projects",
    "roadmap_milestones",
)

_HELPERS = (
    "pulse_rls_company_id",
    "pulse_rls_is_system_admin",
    "pulse_rls_tenant_visible",
    "pulse_rls_tenant_visible_nullable",
)


@pytest.mark.asyncio
async def test_pulse_rls_context_sets_gucs(db_session):
    await apply_pulse_rls_context(
        db_session,
        company_id=_TENANT_A,
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
    assert row[0] == _TENANT_A
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
    """Migration 1021/1051 helpers deny rows when tenant GUC is unset."""
    fn = (
        await db_session.execute(
            text("SELECT pulse_rls_tenant_visible(:cid::uuid)"),
            {"cid": _TENANT_A},
        )
    ).scalar()
    assert fn is False


@pytest.mark.asyncio
async def test_pulse_rls_helpers_respect_tenant_and_admin_gucs(db_session):
    await apply_pulse_rls_context(db_session, company_id=_TENANT_A, is_system_admin=False)
    own = (
        await db_session.execute(
            text("SELECT pulse_rls_tenant_visible(:cid::uuid)"),
            {"cid": _TENANT_A},
        )
    ).scalar()
    other = (
        await db_session.execute(
            text("SELECT pulse_rls_tenant_visible(:cid::uuid)"),
            {"cid": _TENANT_B},
        )
    ).scalar()
    assert own is True
    assert other is False

    await apply_pulse_rls_system_context(db_session)
    admin_other = (
        await db_session.execute(
            text("SELECT pulse_rls_tenant_visible(:cid::uuid)"),
            {"cid": _TENANT_B},
        )
    ).scalar()
    assert admin_other is True


@pytest.mark.asyncio
async def test_pulse_rls_helper_search_path_is_fixed(db_session):
    rows = (
        await db_session.execute(
            text(
                """
                SELECT p.proname, p.proconfig
                FROM pg_proc p
                JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname LIKE 'pulse_rls_%'
                """
            )
        )
    ).all()
    found = {r[0] for r in rows}
    assert set(_HELPERS) <= found
    for name, config in rows:
        if name not in _HELPERS:
            continue
        assert config, f"{name} missing proconfig/search_path"
        joined = " ".join(config)
        assert "search_path" in joined
        assert "pg_catalog" in joined


@pytest.mark.asyncio
async def test_all_public_tables_have_rls_enabled(db_session):
    missing = (
        await db_session.execute(
            text(
                """
                SELECT c.relname
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public'
                  AND c.relkind = 'r'
                  AND NOT c.relrowsecurity
                ORDER BY 1
                """
            )
        )
    ).scalars().all()
    assert missing == [], f"public tables without RLS: {missing}"


@pytest.mark.asyncio
async def test_application_tables_force_rls_except_alembic_version(db_session):
    unforced = (
        await db_session.execute(
            text(
                """
                SELECT c.relname
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public'
                  AND c.relkind = 'r'
                  AND c.relrowsecurity
                  AND NOT c.relforcerowsecurity
                  AND c.relname <> 'alembic_version'
                ORDER BY 1
                """
            )
        )
    ).scalars().all()
    assert unforced == [], f"application tables missing FORCE RLS: {unforced}"


@pytest.mark.asyncio
async def test_application_tables_have_rls_policies(db_session):
    missing = (
        await db_session.execute(
            text(
                """
                SELECT c.relname
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public'
                  AND c.relkind = 'r'
                  AND c.relname <> 'alembic_version'
                  AND NOT EXISTS (
                    SELECT 1 FROM pg_policies p
                    WHERE p.schemaname = 'public' AND p.tablename = c.relname
                  )
                ORDER BY 1
                """
            )
        )
    ).scalars().all()
    assert missing == [], f"public tables missing RLS policies: {missing}"


@pytest.mark.asyncio
async def test_alembic_version_rls_has_no_policies(db_session):
    enabled = (
        await db_session.execute(
            text(
                """
                SELECT c.relrowsecurity, c.relforcerowsecurity
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public' AND c.relname = 'alembic_version'
                """
            )
        )
    ).one()
    assert enabled[0] is True
    assert enabled[1] is False
    policies = (
        await db_session.execute(
            text(
                "SELECT policyname FROM pg_policies "
                "WHERE schemaname='public' AND tablename='alembic_version'"
            )
        )
    ).scalars().all()
    assert policies == []


@pytest.mark.asyncio
async def test_phase3_tables_have_expected_policies(db_session):
    for table in _PHASE3_TABLES:
        exists = (
            await db_session.execute(
                text(
                    """
                    SELECT c.relrowsecurity
                    FROM pg_class c
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'public' AND c.relname = :t AND c.relkind = 'r'
                    """
                ),
                {"t": table},
            )
        ).scalar()
        assert exists is True, f"{table} must have RLS enabled"

    companies_def = (
        await db_session.execute(
            text(
                """
                SELECT pg_get_expr(polqual, polrelid)
                FROM pg_policy pol
                JOIN pg_class c ON c.oid = pol.polrelid
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public' AND c.relname = 'companies'
                  AND pol.polname = 'pulse_rls_companies_select'
                """
            )
        )
    ).scalar()
    assert companies_def
    assert "pulse_rls_company_id" in companies_def

    templates_def = (
        await db_session.execute(
            text(
                """
                SELECT pg_get_expr(polqual, polrelid)
                FROM pg_policy pol
                JOIN pg_class c ON c.oid = pol.polrelid
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public' AND c.relname = 'ops_checklist_templates'
                  AND pol.polname = 'pulse_rls_ops_checklist_templates_select'
                """
            )
        )
    ).scalar()
    assert templates_def
    assert "COMPANY_ID IS NULL" in templates_def.upper()

    refresh_pol = (
        await db_session.execute(
            text(
                """
                SELECT policyname FROM pg_policies
                WHERE schemaname='public' AND tablename='user_refresh_sessions'
                  AND policyname LIKE 'pulse_rls_child_user_refresh_sessions_%'
                """
            )
        )
    ).scalars().all()
    assert len(refresh_pol) == 4


@pytest.mark.asyncio
async def test_non_superuser_role_cannot_see_other_tenant_or_alembic(
    db_session, seeded_tenant
):
    role = "pulse_rls_t_" + uuid.uuid4().hex[:12]
    assert re.fullmatch(r"pulse_rls_t_[0-9a-f]+", role)

    await db_session.execute(text(f"CREATE ROLE {role} NOLOGIN NOBYPASSRLS NOSUPERUSER"))
    try:
        await db_session.execute(text(f"GRANT USAGE ON SCHEMA public TO {role}"))
        await db_session.execute(
            text(
                f"GRANT SELECT ON companies, alembic_version, ops_people, "
                f"user_refresh_sessions TO {role}"
            )
        )
        await db_session.execute(text(f"SET ROLE {role}"))
        try:
            await apply_pulse_rls_context(
                db_session, company_id=seeded_tenant.company_id, is_system_admin=False
            )
            companies = (
                await db_session.execute(
                    text("SELECT id::text FROM companies ORDER BY id")
                )
            ).scalars().all()
            assert companies == [seeded_tenant.company_id]

            other = (
                await db_session.execute(
                    text("SELECT count(*) FROM companies WHERE id::text <> :cid"),
                    {"cid": seeded_tenant.company_id},
                )
            ).scalar()
            assert int(other or 0) == 0

            alembic_rows = (
                await db_session.execute(text("SELECT count(*) FROM alembic_version"))
            ).scalar()
            assert int(alembic_rows or 0) == 0

            ops_rows = (
                await db_session.execute(text("SELECT count(*) FROM ops_people"))
            ).scalar()
            assert int(ops_rows or 0) == 0
        finally:
            await db_session.execute(text("RESET ROLE"))
    finally:
        await db_session.execute(text("RESET ROLE"))
        await db_session.execute(text(f"DROP ROLE IF EXISTS {role}"))


@pytest.mark.asyncio
async def test_cross_tenant_select_blocked_when_rls_enforced(db_session, seeded_tenant):
    """
    Optional integration: set TEST_DATABASE_RLS_ROLE to a non-superuser role with SELECT on jobs.

    Superuser connections bypass RLS; this test documents expected behavior when enforced.
    """
    rls_role = os.environ.get("TEST_DATABASE_RLS_ROLE", "").strip()
    if not rls_role:
        pytest.skip("Set TEST_DATABASE_RLS_ROLE to exercise enforced RLS")

    await db_session.execute(text(f"SET ROLE {rls_role}"))
    try:
        await apply_pulse_rls_context(
            db_session, company_id=seeded_tenant.company_id, is_system_admin=False
        )
        count = (
            await db_session.execute(
                text("SELECT count(*) FROM jobs WHERE company_id = :cid"),
                {"cid": _TENANT_B},
            )
        ).scalar()
        assert int(count or 0) == 0
    finally:
        await db_session.execute(text("RESET ROLE"))
