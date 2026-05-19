"""Add department_slug to schedule shifts and projects for per-department scheduling."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "1008_schedule_department_scope"
down_revision = "1007_project_schedule_overlay"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "pulse_schedule_shifts",
        sa.Column("department_slug", sa.String(32), nullable=True),
    )
    op.add_column(
        "pulse_projects",
        sa.Column("department_slug", sa.String(32), nullable=True),
    )
    op.create_index("ix_pulse_schedule_shifts_department_slug", "pulse_schedule_shifts", ["department_slug"])
    op.create_index("ix_pulse_projects_department_slug", "pulse_projects", ["department_slug"])
    # Shifts: prefer worker HR department slug, else maintenance.
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
    op.execute(sa.text("UPDATE pulse_schedule_shifts SET department_slug = 'maintenance' WHERE department_slug IS NULL"))
    op.execute(sa.text("UPDATE pulse_projects SET department_slug = 'maintenance' WHERE department_slug IS NULL"))


def downgrade() -> None:
    op.drop_index("ix_pulse_projects_department_slug", table_name="pulse_projects")
    op.drop_index("ix_pulse_schedule_shifts_department_slug", table_name="pulse_schedule_shifts")
    op.drop_column("pulse_projects", "department_slug")
    op.drop_column("pulse_schedule_shifts", "department_slug")
