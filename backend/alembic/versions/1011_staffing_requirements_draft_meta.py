"""Staffing demand targets and draft-generation metadata on schedule shifts."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1011_staffing_requirements_draft_meta"
down_revision = "1010_employee_availability"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_create_table(
        op,
        conn,
        "staffing_requirements",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column(
            "company_id",
            UUID(as_uuid=False),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("shift_type", sa.String(32), nullable=False),
        sa.Column("required_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("required_certifications", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("zone_id", UUID(as_uuid=False), sa.ForeignKey("zones.id", ondelete="SET NULL"), nullable=True),
        sa.Column("event_id", UUID(as_uuid=False), nullable=True),
        sa.Column("source", sa.String(64), nullable=False, server_default="inferred"),
        sa.Column("confidence_score", sa.Float(), nullable=False, server_default="0.5"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    ah.safe_create_index(op, conn, "ix_staffing_requirements_company_id", "staffing_requirements", ["company_id"])
    ah.safe_create_index(op, conn, "ix_staffing_requirements_date", "staffing_requirements", ["date"])
    ah.safe_create_index(
        op,
        conn,
        "ix_staffing_requirements_company_date",
        "staffing_requirements",
        ["company_id", "date"],
    )

    ah.safe_add_column(
        op,
        conn,
        "pulse_schedule_shifts",
        sa.Column("locked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    ah.safe_add_column(
        op,
        conn,
        "pulse_schedule_shifts",
        sa.Column("generated_by", sa.String(64), nullable=True),
    )
    ah.safe_add_column(
        op,
        conn,
        "pulse_schedule_shifts",
        sa.Column("confidence_score", sa.Float(), nullable=True),
    )
    ah.safe_add_column(
        op,
        conn,
        "pulse_schedule_shifts",
        sa.Column("recommendation_reason", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_column(op, conn, "pulse_schedule_shifts", "recommendation_reason")
    ah.safe_drop_column(op, conn, "pulse_schedule_shifts", "confidence_score")
    ah.safe_drop_column(op, conn, "pulse_schedule_shifts", "generated_by")
    ah.safe_drop_column(op, conn, "pulse_schedule_shifts", "locked")
    ah.safe_drop_index(op, conn, "ix_staffing_requirements_company_date", "staffing_requirements")
    ah.safe_drop_index(op, conn, "ix_staffing_requirements_date", "staffing_requirements")
    ah.safe_drop_index(op, conn, "ix_staffing_requirements_company_id", "staffing_requirements")
    ah.safe_drop_table(op, conn, "staffing_requirements")
