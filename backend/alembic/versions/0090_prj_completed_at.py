"""project completed_at timestamp

Revision ID: 0090_prj_completed_at
Revises: 0089_prj_materials_repop
Create Date: 2026-04-30
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0090_prj_completed_at"
down_revision = "0089_prj_materials_repop"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("pulse_projects", sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_pulse_projects_completed_at", "pulse_projects", ["completed_at"])


def downgrade() -> None:
    op.drop_index("ix_pulse_projects_completed_at", table_name="pulse_projects")
    op.drop_column("pulse_projects", "completed_at")

