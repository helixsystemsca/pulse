"""Owning department slug on procedures (training matrix department scope)."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0120_pulse_procedure_department_category"
down_revision = "0119_pulse_user_feedback_deleted_at"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "pulse_procedures",
        sa.Column("department_category", sa.String(length=32), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("pulse_procedures", "department_category")
