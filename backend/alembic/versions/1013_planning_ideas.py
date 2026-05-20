"""Planning ideas intake backlog (pre-project approval)."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1013_planning_ideas"
down_revision = "1012_login_event_session_origin"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_create_table(
        op,
        conn,
        "planning_ideas",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column(
            "company_id",
            UUID(as_uuid=False),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column("category", sa.String(128), nullable=True),
        sa.Column("estimated_cost", sa.Numeric(14, 2), nullable=True),
        sa.Column("priority", sa.String(16), nullable=False, server_default="medium"),
        sa.Column("status", sa.String(32), nullable=False, server_default="idea"),
        sa.Column(
            "created_by_user_id",
            UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "linked_project_id",
            UUID(as_uuid=False),
            sa.ForeignKey("pulse_projects.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("timezone('utc', now())"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("timezone('utc', now())"),
        ),
        sa.Column("converted_at", sa.DateTime(timezone=True), nullable=True),
    )
    ah.safe_create_index(op, conn, "ix_planning_ideas_company_id", "planning_ideas", ["company_id"])
    ah.safe_create_index(op, conn, "ix_planning_ideas_status", "planning_ideas", ["status"])
    ah.safe_create_index(op, conn, "ix_planning_ideas_linked_project_id", "planning_ideas", ["linked_project_id"])
    ah.safe_create_index(op, conn, "ix_planning_ideas_created_at", "planning_ideas", ["created_at"])


def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, "ix_planning_ideas_created_at", "planning_ideas")
    ah.safe_drop_index(op, conn, "ix_planning_ideas_linked_project_id", "planning_ideas")
    ah.safe_drop_index(op, conn, "ix_planning_ideas_status", "planning_ideas")
    ah.safe_drop_index(op, conn, "ix_planning_ideas_company_id", "planning_ideas")
    ah.safe_drop_table(op, conn, "planning_ideas")
