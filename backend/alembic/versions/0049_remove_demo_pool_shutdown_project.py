"""Remove auto-seeded demo project \"3-Week Pool Shutdown\" (no longer created).

Revision ID: 0049
Revises: 0048
Create Date: 2026-04-07

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0049"
down_revision = "0048"
branch_labels = None
depends_on = None

DEMO_NAME = "3-Week Pool Shutdown"
DEMO_DESC = "Full pool maintenance and safety cycle (demo project)."


def upgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            """
            DELETE FROM pulse_schedule_shifts
            WHERE id IN (
                SELECT calendar_shift_id FROM pulse_project_tasks
                WHERE project_id IN (
                    SELECT id FROM pulse_projects WHERE name = :name AND description = :desc
                )
                AND calendar_shift_id IS NOT NULL
            )
            """
        ),
        {"name": DEMO_NAME, "desc": DEMO_DESC},
    )
    bind.execute(
        sa.text("DELETE FROM pulse_projects WHERE name = :name AND description = :desc"),
        {"name": DEMO_NAME, "desc": DEMO_DESC},
    )


def downgrade() -> None:
    pass
