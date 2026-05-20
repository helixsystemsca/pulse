"""Add department_slug to schedule shifts and projects for per-department scheduling."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1008_schedule_dept"
down_revision = "1007_schedule_overlay"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(
        op,
        conn,
        "pulse_schedule_shifts",
        sa.Column("department_slug", sa.String(32), nullable=True),
    )
    ah.safe_add_column(
        op,
        conn,
        "pulse_projects",
        sa.Column("department_slug", sa.String(32), nullable=True),
    )
    ah.safe_create_index(
        op, conn, "ix_pulse_schedule_shifts_department_slug", "pulse_schedule_shifts", ["department_slug"]
    )
    ah.safe_create_index(op, conn, "ix_pulse_projects_department_slug", "pulse_projects", ["department_slug"])
    if ah.table_exists(conn, "pulse_schedule_shifts") and ah.column_exists(conn, "pulse_schedule_shifts", "department_slug"):
        op.execute(
            sa.text(
                """
                UPDATE pulse_schedule_shifts AS s
                SET department_slug = COALESCE(
                    NULLIF(LOWER(TRIM(hr.department_slugs->>0)), ''),
                    NULLIF(LOWER(TRIM(hr.department)), ''),
                    'maintenance'
                )
                FROM pulse_worker_hr AS hr
                WHERE hr.user_id = s.assigned_user_id
                  AND s.department_slug IS NULL
                """
            )
        )
        op.execute(
            sa.text("UPDATE pulse_schedule_shifts SET department_slug = 'maintenance' WHERE department_slug IS NULL")
        )
    if ah.table_exists(conn, "pulse_projects") and ah.column_exists(conn, "pulse_projects", "department_slug"):
        op.execute(sa.text("UPDATE pulse_projects SET department_slug = 'maintenance' WHERE department_slug IS NULL"))


def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, "ix_pulse_projects_department_slug", "pulse_projects")
    ah.safe_drop_index(op, conn, "ix_pulse_schedule_shifts_department_slug", "pulse_schedule_shifts")
    ah.safe_drop_column(op, conn, "pulse_projects", "department_slug")
    ah.safe_drop_column(op, conn, "pulse_schedule_shifts", "department_slug")
