"""Strategic roadmap — portfolio timeline projects and milestones."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1045_roadmap"
down_revision = "1044_trim_unreferenced_club_departments"
branch_labels = None
depends_on = None

_TS = sa.text("timezone('utc', now())")


def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_create_table(
        op,
        conn,
        "roadmap_projects",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(32), nullable=False, server_default="projects"),
        sa.Column("owner", sa.String(255), nullable=True),
        sa.Column("owner_user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("color", sa.String(32), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("progress", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("priority", sa.String(16), nullable=False, server_default="medium"),
        sa.Column("status", sa.String(32), nullable=False, server_default="planned"),
        sa.Column("budget", sa.Numeric(14, 2), nullable=True),
        sa.Column("tags", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("dependencies", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("attachments", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("archived", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_by_user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
    )
    ah.safe_create_index(op, conn, "ix_roadmap_projects_company_id", "roadmap_projects", ["company_id"])
    ah.safe_create_index(op, conn, "ix_roadmap_projects_start_date", "roadmap_projects", ["start_date"])
    ah.safe_create_index(op, conn, "ix_roadmap_projects_status", "roadmap_projects", ["status"])

    ah.safe_create_table(
        op,
        conn,
        "roadmap_milestones",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "roadmap_project_id",
            UUID(as_uuid=False),
            sa.ForeignKey("roadmap_projects.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("milestone_date", sa.Date(), nullable=False),
        sa.Column("completed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
    )
    ah.safe_create_index(op, conn, "ix_roadmap_milestones_company_id", "roadmap_milestones", ["company_id"])
    ah.safe_create_index(op, conn, "ix_roadmap_milestones_project_id", "roadmap_milestones", ["roadmap_project_id"])
    ah.safe_create_index(op, conn, "ix_roadmap_milestones_date", "roadmap_milestones", ["milestone_date"])


def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, "ix_roadmap_milestones_date", "roadmap_milestones")
    ah.safe_drop_index(op, conn, "ix_roadmap_milestones_project_id", "roadmap_milestones")
    ah.safe_drop_index(op, conn, "ix_roadmap_milestones_company_id", "roadmap_milestones")
    ah.safe_drop_table(op, conn, "roadmap_milestones")
    ah.safe_drop_index(op, conn, "ix_roadmap_projects_status", "roadmap_projects")
    ah.safe_drop_index(op, conn, "ix_roadmap_projects_start_date", "roadmap_projects")
    ah.safe_drop_index(op, conn, "ix_roadmap_projects_company_id", "roadmap_projects")
    ah.safe_drop_table(op, conn, "roadmap_projects")
