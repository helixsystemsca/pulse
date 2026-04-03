"""Project tasks: location_tag_id (BLE/equipment), sop_id (SOP link)."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("pulse_project_tasks", sa.Column("location_tag_id", sa.String(128), nullable=True))
    op.add_column("pulse_project_tasks", sa.Column("sop_id", sa.String(128), nullable=True))
    op.create_index(
        "ix_pulse_project_tasks_company_location_tag",
        "pulse_project_tasks",
        ["company_id", "location_tag_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_pulse_project_tasks_company_location_tag", table_name="pulse_project_tasks")
    op.drop_column("pulse_project_tasks", "sop_id")
    op.drop_column("pulse_project_tasks", "location_tag_id")
