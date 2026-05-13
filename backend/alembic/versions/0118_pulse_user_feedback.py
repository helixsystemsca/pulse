"""Persisted product feedback (tenant admin inbox)."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0118_pulse_user_feedback"
down_revision = "0117_user_lockout_token_version"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pulse_user_feedback",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column(
            "company_id",
            UUID(as_uuid=False),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "author_user_id",
            UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("feature_key", sa.String(length=64), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("admin_read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("xp_awarded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("xp_amount", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "rewarded_by_user_id",
            UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_pulse_user_feedback_company_id", "pulse_user_feedback", ["company_id"])
    op.create_index("ix_pulse_user_feedback_author_user_id", "pulse_user_feedback", ["author_user_id"])
    op.create_index(
        "ix_pulse_user_feedback_company_unread",
        "pulse_user_feedback",
        ["company_id", "admin_read_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_pulse_user_feedback_company_unread", table_name="pulse_user_feedback")
    op.drop_index("ix_pulse_user_feedback_author_user_id", table_name="pulse_user_feedback")
    op.drop_index("ix_pulse_user_feedback_company_id", table_name="pulse_user_feedback")
    op.drop_table("pulse_user_feedback")
