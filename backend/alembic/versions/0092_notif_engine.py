"""notification engine: rules, logs, task material status; rename legacy notification_rules

Revision ID: 0092_notif_engine
Revises: 0091_prj_notify_eq
Create Date: 2026-04-30
"""

from __future__ import annotations

import sys
from pathlib import Path

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402
from sqlalchemy import text

revision = "0092_notif_engine"
down_revision = "0091_prj_notify_eq"
branch_labels = None
depends_on = None


def _release_legacy_notification_rules_names(conn) -> None:
    """
    After ``notification_rules`` → ``tenant_notification_rules``, PostgreSQL keeps constraint and
    index names like ``notification_rules_pkey`` / ``ix_notification_rules_company_id``, which
    collide when creating the new project-scoped ``notification_rules`` table.
    """
    for (cname,) in conn.execute(
        text(
            """
            SELECT c.conname
            FROM pg_constraint c
            JOIN pg_class rel ON rel.oid = c.conrelid
            WHERE rel.relname = 'tenant_notification_rules'
              AND c.conname LIKE 'notification_rules%'
            ORDER BY c.conname
            """
        )
    ).fetchall():
        suffix = cname[len("notification_rules") :].lstrip("_")
        new_cname = f"tenant_notification_rules_{suffix}" if suffix else "tenant_notification_rules_pkey"
        op.execute(text(f'ALTER TABLE tenant_notification_rules RENAME CONSTRAINT "{cname}" TO "{new_cname}"'))

    for (iname,) in conn.execute(
        text(
            """
            SELECT i.relname
            FROM pg_class i
            JOIN pg_index ix ON i.oid = ix.indexrelid
            JOIN pg_class t ON t.oid = ix.indrelid
            WHERE t.relname = 'tenant_notification_rules'
              AND i.relkind = 'i'
              AND i.relname LIKE 'ix_notification_rules_%'
            ORDER BY i.relname
            """
        )
    ).fetchall():
        rest = iname[len("ix_notification_rules") :].lstrip("_")
        new_iname = f"ix_tenant_notification_rules_{rest}" if rest else "ix_tenant_notification_rules"
        op.execute(text(f'ALTER INDEX "{iname}" RENAME TO "{new_iname}"'))


def upgrade() -> None:
    conn = op.get_bind()

    # Legacy domain table shared the name `notification_rules`; project engine needs that name.
    renamed_legacy = False
    if ah.table_exists(conn, "notification_rules") and ah.column_exists(conn, "notification_rules", "event_pattern"):
        op.rename_table("notification_rules", "tenant_notification_rules")
        renamed_legacy = True
        _release_legacy_notification_rules_names(conn)

    if not ah.column_exists(conn, "pulse_project_task_materials", "status"):
        op.add_column(
            "pulse_project_task_materials",
            sa.Column("status", sa.String(32), nullable=False, server_default="in_stock"),
        )
        op.create_index("ix_pulse_project_task_materials_status", "pulse_project_task_materials", ["status"])

    if not (
        ah.table_exists(conn, "notification_rules")
        and ah.column_exists(conn, "notification_rules", "offset_days")
    ):
        op.create_table(
            "notification_rules",
            sa.Column("id", UUID(as_uuid=False), primary_key=True),
            sa.Column(
                "project_id",
                UUID(as_uuid=False),
                sa.ForeignKey("pulse_projects.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "company_id",
                UUID(as_uuid=False),
                sa.ForeignKey("companies.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("type", sa.String(64), nullable=False),
            sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("offset_days", sa.Integer(), nullable=False),
            sa.Column("conditions", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
            sa.Column("recipients", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("timezone('utc', now())"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("timezone('utc', now())"), nullable=False),
        )
        op.create_index("ix_notification_rules_company_enabled", "notification_rules", ["company_id", "enabled"])

    if not ah.table_exists(conn, "notification_logs"):
        op.create_table(
            "notification_logs",
            sa.Column("id", UUID(as_uuid=False), primary_key=True),
            sa.Column(
                "project_id",
                UUID(as_uuid=False),
                sa.ForeignKey("pulse_projects.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "company_id",
                UUID(as_uuid=False),
                sa.ForeignKey("companies.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "rule_id",
                UUID(as_uuid=False),
                sa.ForeignKey("notification_rules.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("triggered", sa.Boolean(), nullable=False),
            sa.Column("reason", sa.Text(), nullable=False),
            sa.Column("evaluated_at", sa.DateTime(timezone=True), server_default=sa.text("timezone('utc', now())"), nullable=False),
            sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=False),
            sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("recipients_resolved", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        )
        op.create_index("ix_notification_logs_project_evaluated", "notification_logs", ["project_id", "evaluated_at"])


def downgrade() -> None:
    conn = op.get_bind()

    if ah.table_exists(conn, "notification_logs"):
        op.drop_index("ix_notification_logs_project_evaluated", table_name="notification_logs")
        op.drop_table("notification_logs")

    if ah.table_exists(conn, "notification_rules") and ah.column_exists(conn, "notification_rules", "offset_days"):
        op.drop_index("ix_notification_rules_company_enabled", table_name="notification_rules")
        op.drop_table("notification_rules")

    if ah.table_exists(conn, "tenant_notification_rules"):
        op.rename_table("tenant_notification_rules", "notification_rules")

    if ah.column_exists(conn, "pulse_project_task_materials", "status"):
        op.drop_index("ix_pulse_project_task_materials_status", table_name="pulse_project_task_materials")
        op.drop_column("pulse_project_task_materials", "status")
