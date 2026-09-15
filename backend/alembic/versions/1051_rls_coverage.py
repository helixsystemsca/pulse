"""
RLS phase 3 — complete public-schema coverage + helper search_path.

Closes the 2026-09-15 advisor gap: tables created after 1021/1023 never received
policies (ops_*, planner_*, roadmap_*, child purchasing/draft lines), plus
companies, user_refresh_sessions, and alembic_version.

Requires pulse_rls_* helpers from 1021. Recreates those helpers with a fixed
search_path (Supabase function_search_path_mutable).
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

from alembic import op
from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1051_rls_coverage"
down_revision = "1050_daily_planner"
branch_labels = None
depends_on = None

_IDENT_RE = re.compile(r"^[a-z_][a-z0-9_]*$")

# Advisor snapshot 2026-09-15: public tables without RLS (39).
_EXPLICIT_TENANT_TABLES = (
    "ops_knowledge_articles",
    "ops_meetings",
    "ops_people",
    "ops_contractors",
    "ops_regulations",
    "ops_facilities",
    "ops_quick_notes",
    "ops_contacts",
    "ops_entity_links",
    "ops_revisions",
    "ops_personal_profiles",
    "ops_role_responsibilities",
    "ops_authority_matrix_rows",
    "ops_checklist_instances",
    "ops_checklist_items",
    "ops_knowledge_gaps",
    "ops_skills",
    "ops_skill_ratings",
    "ops_development_plans",
    "ops_team_risks",
    "planner_categories",
    "planner_settings",
    "planner_routine_blocks",
    "planner_tasks",
    "planner_calendar_events",
    "planner_interruptions",
    "planner_blockers",
    "planner_schedule_blocks",
    "planner_task_history",
    "planner_time_entries",
    "planner_daily_metrics",
    "roadmap_projects",
    "roadmap_milestones",
)

_CHILD_POLICIES: dict[str, str] = {
    "material_request_draft_items": """
        EXISTS (
          SELECT 1 FROM material_request_drafts d
          WHERE d.id = material_request_draft_items.draft_id
            AND public.pulse_rls_tenant_visible(d.company_id)
        )
    """,
    "purchasing_quick_purchase_lines": """
        EXISTS (
          SELECT 1 FROM purchasing_quick_purchases p
          WHERE p.id = purchasing_quick_purchase_lines.purchase_id
            AND public.pulse_rls_tenant_visible(p.company_id)
        )
    """,
    "user_refresh_sessions": """
        EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = user_refresh_sessions.user_id
            AND public.pulse_rls_tenant_visible_nullable(u.company_id)
        )
    """,
}

# System seed templates use NULL company_id and must remain readable by tenants.
_CHECKLIST_TEMPLATE_SELECT = """
    public.pulse_rls_is_system_admin()
    OR company_id IS NULL
    OR public.pulse_rls_tenant_visible_nullable(company_id)
"""
_CHECKLIST_TEMPLATE_WRITE = """
    public.pulse_rls_is_system_admin()
    OR public.pulse_rls_tenant_visible(company_id)
"""

_RLS_FUNCTION_SQL = """
CREATE OR REPLACE FUNCTION public.pulse_rls_company_id() RETURNS uuid
LANGUAGE sql
STABLE
SET search_path TO pg_catalog
AS $$
  SELECT NULLIF(btrim(current_setting('pulse.company_id', true)), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.pulse_rls_is_system_admin() RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO pg_catalog
AS $$
  SELECT coalesce(current_setting('pulse.is_system_admin', true), '') = 'true';
$$;

CREATE OR REPLACE FUNCTION public.pulse_rls_tenant_visible(row_company_id uuid) RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO pg_catalog
AS $$
  SELECT public.pulse_rls_is_system_admin()
    OR (
      public.pulse_rls_company_id() IS NOT NULL
      AND row_company_id IS NOT NULL
      AND row_company_id = public.pulse_rls_company_id()
    );
$$;

CREATE OR REPLACE FUNCTION public.pulse_rls_tenant_visible_nullable(row_company_id uuid) RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO pg_catalog
AS $$
  SELECT public.pulse_rls_is_system_admin()
    OR (
      public.pulse_rls_company_id() IS NOT NULL
      AND row_company_id IS NOT NULL
      AND row_company_id = public.pulse_rls_company_id()
    );
$$;
"""

_RLS_FUNCTION_SQL_DOWN = """
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


def _quote(name: str) -> str:
    if not _IDENT_RE.match(name):
        raise ValueError(f"refusing non-identifier table name: {name!r}")
    return f'"{name}"'


def _table_exists(conn, table: str) -> bool:
    return bool(
        conn.execute(
            text(
                "SELECT 1 FROM information_schema.tables "
                "WHERE table_schema='public' AND table_name=:t"
            ),
            {"t": table},
        ).fetchone()
    )


def _has_named_policy(conn, table: str, policy: str) -> bool:
    return bool(
        conn.execute(
            text(
                "SELECT 1 FROM pg_policies "
                "WHERE schemaname='public' AND tablename=:t AND policyname=:p"
            ),
            {"t": table, "p": policy},
        ).fetchone()
    )


def _policy_names(table: str, prefix: str = "pulse_rls") -> dict[str, str]:
    return {
        "select": f"{prefix}_{table}_select",
        "insert": f"{prefix}_{table}_insert",
        "update": f"{prefix}_{table}_update",
        "delete": f"{prefix}_{table}_delete",
    }


def _enable_rls(conn, table: str, *, force: bool) -> None:
    q = _quote(table)
    conn.execute(text(f"ALTER TABLE {q} ENABLE ROW LEVEL SECURITY"))
    if force:
        conn.execute(text(f"ALTER TABLE {q} FORCE ROW LEVEL SECURITY"))


def _drop_policies(conn, table: str, names: dict[str, str]) -> None:
    q = _quote(table)
    for pol in names.values():
        conn.execute(text(f"DROP POLICY IF EXISTS {_quote(pol)} ON {q}"))


def _create_crud_policies(conn, table: str, names: dict[str, str], using_expr: str, check_expr: str) -> None:
    q = _quote(table)
    conn.execute(text(f'CREATE POLICY {_quote(names["select"])} ON {q} FOR SELECT USING ({using_expr})'))
    conn.execute(
        text(
            f'CREATE POLICY {_quote(names["insert"])} ON {q} FOR INSERT '
            f"WITH CHECK ({check_expr})"
        )
    )
    conn.execute(
        text(
            f'CREATE POLICY {_quote(names["update"])} ON {q} FOR UPDATE '
            f"USING ({using_expr}) WITH CHECK ({check_expr})"
        )
    )
    conn.execute(text(f'CREATE POLICY {_quote(names["delete"])} ON {q} FOR DELETE USING ({using_expr})'))


def _apply_crud(
    conn,
    table: str,
    using_expr: str,
    *,
    prefix: str = "pulse_rls",
    check_expr: str | None = None,
    replace: bool = False,
) -> None:
    names = _policy_names(table, prefix)
    if not replace and _has_named_policy(conn, table, names["select"]):
        return
    _enable_rls(conn, table, force=True)
    _drop_policies(conn, table, names)
    _create_crud_policies(conn, table, names, using_expr.strip(), (check_expr or using_expr).strip())


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


def _public_base_tables(conn) -> list[str]:
    rows = conn.execute(
        text(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name
            """
        )
    ).fetchall()
    return [r[0] for r in rows]


def _rls_enabled(conn, table: str) -> bool:
    row = conn.execute(
        text(
            """
            SELECT c.relrowsecurity
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname = :t AND c.relkind = 'r'
            """
        ),
        {"t": table},
    ).fetchone()
    return bool(row and row[0])


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(text(_RLS_FUNCTION_SQL))
    for fn in (
        "pulse_rls_company_id()",
        "pulse_rls_is_system_admin()",
        "pulse_rls_tenant_visible(uuid)",
        "pulse_rls_tenant_visible_nullable(uuid)",
    ):
        conn.execute(text(f"ALTER FUNCTION public.{fn} SET search_path TO pg_catalog"))
        conn.execute(text(f"GRANT EXECUTE ON FUNCTION public.{fn} TO PUBLIC"))

    if _table_exists(conn, "companies"):
        _apply_crud(
            conn,
            "companies",
            "public.pulse_rls_is_system_admin() OR id = public.pulse_rls_company_id()",
            replace=True,
        )

    skip_company_id = {"ops_checklist_templates"}
    for table, nullable in _tables_with_company_id(conn):
        if table in skip_company_id:
            continue
        fn = "pulse_rls_tenant_visible_nullable" if nullable else "pulse_rls_tenant_visible"
        _apply_crud(conn, table, f"public.{fn}(company_id)")

    # Override generic company_id policy: system seed templates (NULL company_id) stay readable.
    if _table_exists(conn, "ops_checklist_templates"):
        _apply_crud(
            conn,
            "ops_checklist_templates",
            _CHECKLIST_TEMPLATE_SELECT,
            check_expr=_CHECKLIST_TEMPLATE_WRITE,
            replace=True,
        )

    for table, expr in _CHILD_POLICIES.items():
        if _table_exists(conn, table):
            _apply_crud(conn, table, expr, prefix="pulse_rls_child", replace=True)

    if _table_exists(conn, "alembic_version"):
        # App role must not read/write migration history. Table owner (migrations)
        # still bypasses RLS unless FORCE is set — do not FORCE this table.
        _enable_rls(conn, "alembic_version", force=False)

    for table in _public_base_tables(conn):
        if table == "alembic_version":
            continue
        if not _rls_enabled(conn, table):
            _enable_rls(conn, table, force=True)
        else:
            conn.execute(text(f"ALTER TABLE {_quote(table)} FORCE ROW LEVEL SECURITY"))


def downgrade() -> None:
    conn = op.get_bind()
    for table, expr in _CHILD_POLICIES.items():
        if not _table_exists(conn, table):
            continue
        _drop_policies(conn, table, _policy_names(table, "pulse_rls_child"))
        conn.execute(text(f"ALTER TABLE {_quote(table)} DISABLE ROW LEVEL SECURITY"))

    if _table_exists(conn, "ops_checklist_templates"):
        _drop_policies(conn, "ops_checklist_templates", _policy_names("ops_checklist_templates"))
        conn.execute(text('ALTER TABLE "ops_checklist_templates" DISABLE ROW LEVEL SECURITY'))

    if _table_exists(conn, "companies"):
        _drop_policies(conn, "companies", _policy_names("companies"))
        conn.execute(text('ALTER TABLE "companies" DISABLE ROW LEVEL SECURITY'))

    for table in _EXPLICIT_TENANT_TABLES:
        if not _table_exists(conn, table):
            continue
        _drop_policies(conn, table, _policy_names(table))
        conn.execute(text(f"ALTER TABLE {_quote(table)} DISABLE ROW LEVEL SECURITY"))

    if _table_exists(conn, "alembic_version"):
        conn.execute(text('ALTER TABLE "alembic_version" DISABLE ROW LEVEL SECURITY'))

    conn.execute(text(_RLS_FUNCTION_SQL_DOWN))
    for fn in (
        "pulse_rls_company_id()",
        "pulse_rls_is_system_admin()",
        "pulse_rls_tenant_visible(uuid)",
        "pulse_rls_tenant_visible_nullable(uuid)",
    ):
        conn.execute(text(f"ALTER FUNCTION public.{fn} RESET search_path"))
