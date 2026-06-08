"""Operational improvements Phase 2: framework_data + playbooks."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1040_op_improvement_framework"
down_revision = "1039_operational_improvements"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(
        op,
        conn,
        "operational_improvements",
        sa.Column("framework_data", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
    )

    ah.safe_create_table(
        op,
        conn,
        "operational_improvement_playbooks",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column(
            "company_id",
            UUID(as_uuid=False),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "source_improvement_id",
            UUID(as_uuid=False),
            sa.ForeignKey("operational_improvements.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("category", sa.String(32), nullable=False, server_default="other"),
        sa.Column("template_id", sa.String(64), nullable=True),
        sa.Column("problem", sa.Text(), nullable=True),
        sa.Column("root_cause", sa.Text(), nullable=True),
        sa.Column("solution", sa.Text(), nullable=True),
        sa.Column("results", sa.Text(), nullable=True),
        sa.Column("lessons_learned", sa.Text(), nullable=True),
        sa.Column(
            "created_by_user_id",
            UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("timezone('utc', now())"),
        ),
    )
    ah.safe_create_index(
        op, conn, "ix_op_playbooks_company_id", "operational_improvement_playbooks", ["company_id"]
    )
    ah.safe_create_index(
        op,
        conn,
        "ix_op_playbooks_source_improvement",
        "operational_improvement_playbooks",
        ["source_improvement_id"],
    )


def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, "ix_op_playbooks_source_improvement", "operational_improvement_playbooks")
    ah.safe_drop_index(op, conn, "ix_op_playbooks_company_id", "operational_improvement_playbooks")
    ah.safe_drop_table(op, conn, "operational_improvement_playbooks")
    ah.safe_drop_column(op, conn, "operational_improvements", "framework_data")
