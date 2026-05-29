"""
PostgreSQL Row Level Security (tenant isolation defense-in-depth).

Session GUCs (set per request by FastAPI):
  pulse.company_id       — tenant UUID string
  pulse.is_system_admin  — 'true' | 'false'

Requires a DB role **without** BYPASSRLS for policies to apply (see docs/RLS_POLICY_STRATEGY.md).
Superuser / table-owner connections bypass RLS by default.
"""

from __future__ import annotations

import sys
from pathlib import Path

from alembic import op
from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1021_tenant_rls"
down_revision = "1020_user_ui_preferences"
branch_labels = None
depends_on = None

# Tables managed in phase 2 (child rows — scope via parent FK in application layer).
_CHILD_TABLES_PHASE2 = frozenset(
    {
        "login_events",
        "job_tools",
        "job_inventory",
        "tenant_role_grants",
        "pm_task_parts",
        "pm_task_checklist_items",
        "pulse_work_request_parts",
        "pulse_work_request_checklist_items",
        "blueprint_elements",
        "monitoring_zones",
        "monitored_systems",
        "monitoring_sensors",
        "monitoring_sensor_readings",
        "monitoring_sensor_thresholds",
        "pulse_procedure_acknowledgment_snapshots",
        "pulse_work_request_comments",
        "pulse_work_request_activity",
        "pulse_project_activity",
        "pulse_project_template_tasks",
        "pulse_task_dependencies",
        "pulse_project_automation_rules",
        "pulse_project_summaries",
        "planning_idea_approvals",
        "pm_coord_task_dependencies",
        "pm_coord_task_resources",
        "user_badges",
    }
)

_GLOBAL_READ_TABLES = frozenset({"rbac_catalog_permissions", "badge_definitions"})

_RLS_FUNCTION_SQL = """
CREATE OR REPLACE FUNCTION pulse_rls_company_id() RETURNS uuid AS $$
  SELECT NULLIF(trim(current_setting('pulse.company_id', true)), '')::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION pulse_rls_is_system_admin() RETURNS boolean AS $$
  SELECT coalesce(current_setting('pulse.is_system_admin', true), '') = 'true';
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION pulse_rls_tenant_visible(row_company_id uuid) RETURNS boolean AS $$
  SELECT pulse_rls_is_system_admin()
    OR (
      pulse_rls_company_id() IS NOT NULL
      AND row_company_id IS NOT NULL
      AND row_company_id = pulse_rls_company_id()
    );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION pulse_rls_tenant_visible_nullable(row_company_id uuid) RETURNS boolean AS $$
  SELECT pulse_rls_is_system_admin()
    OR (
      pulse_rls_company_id() IS NOT NULL
      AND row_company_id IS NOT NULL
      AND row_company_id = pulse_rls_company_id()
    );
$$ LANGUAGE sql STABLE;
"""


def _tables_with_company_id(conn) -> list[tuple[str, bool]]:
    rows = conn.execute(
        text(
            """
            SELECT c.table_name,
                   bool_or(c.is_nullable = 'YES') AS company_id_nullable
            FROM information_schema.columns c
            JOIN information_schema.tables t
              ON t.table_schema = c.table_schema AND t.table_name = c.table_name
            WHERE c.table_schema = 'public'
              AND c.column_name = 'company_id'
              AND t.table_type = 'BASE TABLE'
            GROUP BY c.table_name
            ORDER BY c.table_name
            """
        )
    ).fetchall()
    return [(r[0], bool(r[1])) for r in rows]


def _policy_names(table: str) -> dict[str, str]:
    return {
        "select": f"pulse_rls_{table}_select",
        "insert": f"pulse_rls_{table}_insert",
        "update": f"pulse_rls_{table}_update",
        "delete": f"pulse_rls_{table}_delete",
    }


def _enable_tenant_policies(conn, table: str, *, nullable_company_id: bool) -> None:
    if table in _CHILD_TABLES_PHASE2:
        return
    fn = "pulse_rls_tenant_visible_nullable" if nullable_company_id else "pulse_rls_tenant_visible"
    names = _policy_names(table)
    conn.execute(text(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY'))
    conn.execute(text(f'ALTER TABLE "{table}" FORCE ROW LEVEL SECURITY'))
    for _op_name, pol in names.items():
        conn.execute(text(f'DROP POLICY IF EXISTS "{pol}" ON "{table}"'))
    if table == "companies":
        using_expr = "pulse_rls_is_system_admin() OR id = pulse_rls_company_id()"
    else:
        using_expr = f"{fn}(company_id)"
    check_expr = using_expr
    conn.execute(
        text(
            f'CREATE POLICY "{names["select"]}" ON "{table}" FOR SELECT USING ({using_expr})'
        )
    )
    conn.execute(
        text(
            f'CREATE POLICY "{names["insert"]}" ON "{table}" FOR INSERT '
            f"WITH CHECK ({check_expr})"
        )
    )
    conn.execute(
        text(
            f'CREATE POLICY "{names["update"]}" ON "{table}" FOR UPDATE '
            f"USING ({using_expr}) WITH CHECK ({check_expr})"
        )
    )
    conn.execute(
        text(
            f'CREATE POLICY "{names["delete"]}" ON "{table}" FOR DELETE USING ({using_expr})'
        )
    )


def _enable_global_catalog_policies(conn, table: str) -> None:
    conn.execute(text(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY'))
    conn.execute(text(f'ALTER TABLE "{table}" FORCE ROW LEVEL SECURITY'))
    for pol in (f"pulse_rls_{table}_select", f"pulse_rls_{table}_write"):
        conn.execute(text(f'DROP POLICY IF EXISTS "{pol}" ON "{table}"'))
    conn.execute(
        text(
            f'CREATE POLICY "pulse_rls_{table}_select" ON "{table}" '
            f"FOR SELECT USING (true)"
        )
    )
    conn.execute(
        text(
            f'CREATE POLICY "pulse_rls_{table}_write" ON "{table}" '
            f"FOR ALL USING (pulse_rls_is_system_admin()) "
            f"WITH CHECK (pulse_rls_is_system_admin())"
        )
    )


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(text(_RLS_FUNCTION_SQL))
    for table, nullable in _tables_with_company_id(conn):
        _enable_tenant_policies(conn, table, nullable_company_id=nullable)
    for table in _GLOBAL_READ_TABLES:
        if conn.execute(
            text(
                "SELECT 1 FROM information_schema.tables "
                "WHERE table_schema='public' AND table_name=:t"
            ),
            {"t": table},
        ).fetchone():
            _enable_global_catalog_policies(conn, table)
    # system_logs — system admin only
    if conn.execute(
        text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema='public' AND table_name='system_logs'"
        )
    ).fetchone():
        conn.execute(text('ALTER TABLE "system_logs" ENABLE ROW LEVEL SECURITY'))
        conn.execute(text('ALTER TABLE "system_logs" FORCE ROW LEVEL SECURITY'))
        conn.execute(text('DROP POLICY IF EXISTS "pulse_rls_system_logs_all" ON "system_logs"'))
        conn.execute(
            text(
                'CREATE POLICY "pulse_rls_system_logs_all" ON "system_logs" '
                "FOR ALL USING (pulse_rls_is_system_admin()) "
                "WITH CHECK (pulse_rls_is_system_admin())"
            )
        )


def downgrade() -> None:
    conn = op.get_bind()
    for table, _nullable in _tables_with_company_id(conn):
        if table in _CHILD_TABLES_PHASE2:
            continue
        for pol in _policy_names(table).values():
            conn.execute(text(f'DROP POLICY IF EXISTS "{pol}" ON "{table}"'))
        conn.execute(text(f'ALTER TABLE "{table}" DISABLE ROW LEVEL SECURITY'))
    for table in _GLOBAL_READ_TABLES:
        for pol in (f"pulse_rls_{table}_select", f"pulse_rls_{table}_write"):
            conn.execute(text(f'DROP POLICY IF EXISTS "{pol}" ON "{table}"'))
        conn.execute(text(f'ALTER TABLE "{table}" DISABLE ROW LEVEL SECURITY'))
    conn.execute(text('DROP POLICY IF EXISTS "pulse_rls_system_logs_all" ON "system_logs"'))
    conn.execute(text('ALTER TABLE "system_logs" DISABLE ROW LEVEL SECURITY'))
    for fn in (
        "pulse_rls_tenant_visible_nullable",
        "pulse_rls_tenant_visible",
        "pulse_rls_is_system_admin",
        "pulse_rls_company_id",
    ):
        conn.execute(text(f"DROP FUNCTION IF EXISTS {fn}()"))
