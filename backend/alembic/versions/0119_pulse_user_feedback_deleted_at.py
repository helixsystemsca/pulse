"""Soft-delete for product feedback (admin inbox)."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0119_pulse_user_feedback_deleted_at"
down_revision = "0118_pulse_user_feedback"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "pulse_user_feedback",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_pulse_user_feedback_company_active",
        "pulse_user_feedback",
        ["company_id"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_pulse_user_feedback_company_active", table_name="pulse_user_feedback")
    op.drop_column("pulse_user_feedback", "deleted_at")
