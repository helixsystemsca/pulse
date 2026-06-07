"""Operational improvements workflow (opportunity → analysis → plan → results)."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1039_operational_improvements"
down_revision = "1038_qr_resources"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_create_table(
        op,
        conn,
        "operational_improvements",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column(
            "company_id",
            UUID(as_uuid=False),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("display_number", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("department_slug", sa.String(64), nullable=True),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column(
            "zone_id",
            UUID(as_uuid=False),
            sa.ForeignKey("zones.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "reporter_user_id",
            UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("date_identified", sa.Date(), nullable=True),
        sa.Column("priority", sa.String(16), nullable=False, server_default="medium"),
        sa.Column("category", sa.String(32), nullable=False, server_default="other"),
        sa.Column("estimated_impact", sa.Text(), nullable=True),
        sa.Column("current_symptoms", sa.Text(), nullable=True),
        sa.Column("stakeholders_affected", sa.Text(), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="identified"),
        sa.Column("implementation_data", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("measurement_data", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column(
            "knowledge_base_published",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
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
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("timezone('utc', now())"),
        ),
    )
    ah.safe_create_index(
        op, conn, "ix_operational_improvements_company_id", "operational_improvements", ["company_id"]
    )
    ah.safe_create_index(
        op, conn, "ix_operational_improvements_status", "operational_improvements", ["status"]
    )
    ah.safe_create_index(
        op, conn, "ix_operational_improvements_category", "operational_improvements", ["category"]
    )
    ah.safe_create_index(
        op,
        conn,
        "ix_operational_improvements_knowledge_base",
        "operational_improvements",
        ["knowledge_base_published"],
    )

    ah.safe_create_table(
        op,
        conn,
        "operational_improvement_analyses",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column(
            "company_id",
            UUID(as_uuid=False),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "improvement_id",
            UUID(as_uuid=False),
            sa.ForeignKey("operational_improvements.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("analysis_type", sa.String(48), nullable=False),
        sa.Column("title", sa.String(255), nullable=True),
        sa.Column("data", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
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
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("timezone('utc', now())"),
        ),
    )
    ah.safe_create_index(
        op,
        conn,
        "ix_op_improvement_analyses_improvement_id",
        "operational_improvement_analyses",
        ["improvement_id"],
    )

    ah.safe_create_table(
        op,
        conn,
        "operational_improvement_actions",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column(
            "company_id",
            UUID(as_uuid=False),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "improvement_id",
            UUID(as_uuid=False),
            sa.ForeignKey("operational_improvements.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column(
            "owner_user_id",
            UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(24), nullable=False, server_default="pending"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "linked_work_request_id",
            UUID(as_uuid=False),
            sa.ForeignKey("pulse_work_requests.id", ondelete="SET NULL"),
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
    )
    ah.safe_create_index(
        op,
        conn,
        "ix_op_improvement_actions_improvement_id",
        "operational_improvement_actions",
        ["improvement_id"],
    )

    ah.safe_create_table(
        op,
        conn,
        "operational_improvement_attachments",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column(
            "company_id",
            UUID(as_uuid=False),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "improvement_id",
            UUID(as_uuid=False),
            sa.ForeignKey("operational_improvements.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("file_url", sa.Text(), nullable=True),
        sa.Column("attachment_type", sa.String(32), nullable=False, server_default="document"),
        sa.Column("caption", sa.Text(), nullable=True),
        sa.Column(
            "uploaded_by_user_id",
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
        op,
        conn,
        "ix_op_improvement_attachments_improvement_id",
        "operational_improvement_attachments",
        ["improvement_id"],
    )


def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, "ix_op_improvement_attachments_improvement_id", "operational_improvement_attachments")
    ah.safe_drop_table(op, conn, "operational_improvement_attachments")
    ah.safe_drop_index(op, conn, "ix_op_improvement_actions_improvement_id", "operational_improvement_actions")
    ah.safe_drop_table(op, conn, "operational_improvement_actions")
    ah.safe_drop_index(op, conn, "ix_op_improvement_analyses_improvement_id", "operational_improvement_analyses")
    ah.safe_drop_table(op, conn, "operational_improvement_analyses")
    ah.safe_drop_index(op, conn, "ix_operational_improvements_knowledge_base", "operational_improvements")
    ah.safe_drop_index(op, conn, "ix_operational_improvements_category", "operational_improvements")
    ah.safe_drop_index(op, conn, "ix_operational_improvements_status", "operational_improvements")
    ah.safe_drop_index(op, conn, "ix_operational_improvements_company_id", "operational_improvements")
    ah.safe_drop_table(op, conn, "operational_improvements")
