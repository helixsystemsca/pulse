"""
RLS phase 2 — child/junction tables scoped via parent ``company_id``.

Requires migration 1021 helper functions (pulse_rls_*).
"""

from __future__ import annotations

import sys
from pathlib import Path

from alembic import op
from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1023_tenant_rls_child"
down_revision = "1022_tenant_security_policy"
branch_labels = None
depends_on = None

# table -> SQL expression that must be true for tenant visibility (references parent company_id)
_CHILD_POLICIES: dict[str, str] = {
    "login_events": """
        EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = login_events.user_id
            AND pulse_rls_tenant_visible_nullable(u.company_id)
        )
    """,
    "job_tools": """
        EXISTS (
          SELECT 1 FROM jobs j WHERE j.id = job_tools.job_id AND pulse_rls_tenant_visible(j.company_id)
        )
    """,
    "job_inventory": """
        EXISTS (
          SELECT 1 FROM jobs j WHERE j.id = job_inventory.job_id AND pulse_rls_tenant_visible(j.company_id)
        )
    """,
    "tenant_role_grants": """
        EXISTS (
          SELECT 1 FROM tenant_roles tr
          WHERE tr.id = tenant_role_grants.tenant_role_id AND pulse_rls_tenant_visible(tr.company_id)
        )
    """,
    "pm_task_parts": """
        EXISTS (
          SELECT 1 FROM pm_tasks t WHERE t.id = pm_task_parts.pm_task_id AND pulse_rls_tenant_visible(t.company_id)
        )
    """,
    "pm_task_checklist_items": """
        EXISTS (
          SELECT 1 FROM pm_tasks t
          WHERE t.id = pm_task_checklist_items.pm_task_id AND pulse_rls_tenant_visible(t.company_id)
        )
    """,
    "pulse_work_request_parts": """
        EXISTS (
          SELECT 1 FROM pulse_work_requests w
          WHERE w.id = pulse_work_request_parts.work_request_id AND pulse_rls_tenant_visible(w.company_id)
        )
    """,
    "pulse_work_request_checklist_items": """
        EXISTS (
          SELECT 1 FROM pulse_work_requests w
          WHERE w.id = pulse_work_request_checklist_items.work_request_id
            AND pulse_rls_tenant_visible(w.company_id)
        )
    """,
    "pulse_work_request_comments": """
        EXISTS (
          SELECT 1 FROM pulse_work_requests w
          WHERE w.id = pulse_work_request_comments.work_request_id AND pulse_rls_tenant_visible(w.company_id)
        )
    """,
    "pulse_work_request_activity": """
        EXISTS (
          SELECT 1 FROM pulse_work_requests w
          WHERE w.id = pulse_work_request_activity.work_request_id AND pulse_rls_tenant_visible(w.company_id)
        )
    """,
    "blueprint_elements": """
        EXISTS (
          SELECT 1 FROM blueprints b
          WHERE b.id = blueprint_elements.blueprint_id AND pulse_rls_tenant_visible(b.company_id)
        )
    """,
    "monitoring_zones": """
        EXISTS (
          SELECT 1 FROM monitoring_facilities f
          WHERE f.id = monitoring_zones.facility_id AND pulse_rls_tenant_visible(f.company_id)
        )
    """,
    "monitored_systems": """
        EXISTS (
          SELECT 1 FROM monitoring_facilities f
          WHERE f.id = monitored_systems.facility_id AND pulse_rls_tenant_visible(f.company_id)
        )
    """,
    "monitoring_sensors": """
        EXISTS (
          SELECT 1 FROM monitored_systems s
          JOIN monitoring_facilities f ON f.id = s.facility_id
          WHERE s.id = monitoring_sensors.system_id AND pulse_rls_tenant_visible(f.company_id)
        )
    """,
    "monitoring_sensor_readings": """
        EXISTS (
          SELECT 1 FROM monitoring_sensors sen
          JOIN monitored_systems s ON s.id = sen.system_id
          JOIN monitoring_facilities f ON f.id = s.facility_id
          WHERE sen.id = monitoring_sensor_readings.sensor_id AND pulse_rls_tenant_visible(f.company_id)
        )
    """,
    "monitoring_sensor_thresholds": """
        EXISTS (
          SELECT 1 FROM monitoring_sensors sen
          JOIN monitored_systems s ON s.id = sen.system_id
          JOIN monitoring_facilities f ON f.id = s.facility_id
          WHERE sen.id = monitoring_sensor_thresholds.sensor_id AND pulse_rls_tenant_visible(f.company_id)
        )
    """,
    "pulse_procedure_acknowledgment_snapshots": """
        EXISTS (
          SELECT 1 FROM pulse_procedure_acknowledgements a
          WHERE a.id = pulse_procedure_acknowledgment_snapshots.acknowledgment_id
            AND pulse_rls_tenant_visible(a.company_id)
        )
    """,
    "pulse_project_activity": """
        EXISTS (
          SELECT 1 FROM pulse_projects p
          WHERE p.id = pulse_project_activity.project_id AND pulse_rls_tenant_visible(p.company_id)
        )
    """,
    "pulse_project_template_tasks": """
        EXISTS (
          SELECT 1 FROM pulse_project_templates t
          WHERE t.id = pulse_project_template_tasks.template_id AND pulse_rls_tenant_visible(t.company_id)
        )
    """,
    "pulse_project_automation_rules": """
        EXISTS (
          SELECT 1 FROM pulse_projects p
          WHERE p.id = pulse_project_automation_rules.project_id AND pulse_rls_tenant_visible(p.company_id)
        )
    """,
    "pulse_project_summaries": """
        EXISTS (
          SELECT 1 FROM pulse_projects p
          WHERE p.id = pulse_project_summaries.project_id AND pulse_rls_tenant_visible(p.company_id)
        )
    """,
    "planning_idea_approvals": """
        EXISTS (
          SELECT 1 FROM planning_ideas i
          WHERE i.id = planning_idea_approvals.idea_id AND pulse_rls_tenant_visible(i.company_id)
        )
    """,
    "pm_coord_task_dependencies": """
        EXISTS (
          SELECT 1 FROM pm_coord_tasks t
          WHERE t.id = pm_coord_task_dependencies.task_id AND pulse_rls_tenant_visible(t.company_id)
        )
    """,
    "pm_coord_task_resources": """
        EXISTS (
          SELECT 1 FROM pm_coord_tasks t
          WHERE t.id = pm_coord_task_resources.task_id AND pulse_rls_tenant_visible(t.company_id)
        )
    """,
    "user_badges": """
        EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = user_badges.user_id AND pulse_rls_tenant_visible_nullable(u.company_id)
        )
    """,
    "pulse_task_dependencies": """
        EXISTS (
          SELECT 1 FROM pulse_project_tasks t
          WHERE t.id = pulse_task_dependencies.task_id AND pulse_rls_tenant_visible(t.company_id)
        )
        AND EXISTS (
          SELECT 1 FROM pulse_project_tasks t2
          WHERE t2.id = pulse_task_dependencies.depends_on_task_id AND pulse_rls_tenant_visible(t2.company_id)
        )
    """,
}


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


def _apply_child_policies(conn, table: str, using_expr: str) -> None:
    conn.execute(text(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY'))
    conn.execute(text(f'ALTER TABLE "{table}" FORCE ROW LEVEL SECURITY'))
    for suffix in ("select", "insert", "update", "delete"):
        pol = f"pulse_rls_child_{table}_{suffix}"
        conn.execute(text(f'DROP POLICY IF EXISTS "{pol}" ON "{table}"'))
    conn.execute(
        text(f'CREATE POLICY "pulse_rls_child_{table}_select" ON "{table}" FOR SELECT USING ({using_expr})')
    )
    conn.execute(
        text(
            f'CREATE POLICY "pulse_rls_child_{table}_insert" ON "{table}" '
            f"FOR INSERT WITH CHECK ({using_expr})"
        )
    )
    conn.execute(
        text(
            f'CREATE POLICY "pulse_rls_child_{table}_update" ON "{table}" '
            f"FOR UPDATE USING ({using_expr}) WITH CHECK ({using_expr})"
        )
    )
    conn.execute(
        text(f'CREATE POLICY "pulse_rls_child_{table}_delete" ON "{table}" FOR DELETE USING ({using_expr})')
    )


def upgrade() -> None:
    conn = op.get_bind()
    for table, expr in _CHILD_POLICIES.items():
        if _table_exists(conn, table):
            _apply_child_policies(conn, table, expr.strip())


def downgrade() -> None:
    conn = op.get_bind()
    for table in _CHILD_POLICIES:
        if not _table_exists(conn, table):
            continue
        for suffix in ("select", "insert", "update", "delete"):
            conn.execute(text(f'DROP POLICY IF EXISTS "pulse_rls_child_{table}_{suffix}" ON "{table}"'))
        conn.execute(text(f'ALTER TABLE "{table}" DISABLE ROW LEVEL SECURITY'))
