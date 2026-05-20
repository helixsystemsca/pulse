"""Planning idea approval requests + normalize idea statuses to awaiting_review."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1014_idea_approvals"
down_revision = "1013_planning_ideas"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    if ah.table_exists(conn, "planning_ideas"):
        op.execute(
            sa.text(
                "UPDATE planning_ideas SET status = 'awaiting_review' "
                "WHERE status IN ('awaiting_approval', 'reviewing')"
            )
        )

    ah.safe_create_table(
        op,
        conn,
        "planning_idea_approvals",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column(
            "planning_idea_id",
            UUID(as_uuid=False),
            sa.ForeignKey("planning_ideas.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "requested_by_user_id",
            UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "requested_to_user_id",
            UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=False,
        ),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("request_comments", sa.Text(), nullable=True),
        sa.Column("reviewer_comments", sa.Text(), nullable=True),
        sa.Column(
            "requested_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("timezone('utc', now())"),
        ),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("email_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approval_token_hash", sa.String(128), nullable=False),
    )
    ah.safe_create_index(
        op, conn, "ix_planning_idea_approvals_idea_id", "planning_idea_approvals", ["planning_idea_id"]
    )
    ah.safe_create_index(
        op, conn, "ix_planning_idea_approvals_status", "planning_idea_approvals", ["status"]
    )
    ah.safe_create_index(
        op,
        conn,
        "ix_planning_idea_approvals_token_hash",
        "planning_idea_approvals",
        ["approval_token_hash"],
        unique=True,
    )


def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, "ix_planning_idea_approvals_token_hash", "planning_idea_approvals")
    ah.safe_drop_index(op, conn, "ix_planning_idea_approvals_status", "planning_idea_approvals")
    ah.safe_drop_index(op, conn, "ix_planning_idea_approvals_idea_id", "planning_idea_approvals")
    ah.safe_drop_table(op, conn, "planning_idea_approvals")
