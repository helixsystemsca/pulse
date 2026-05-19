"""Staffing demand targets and draft-generation metadata on schedule shifts."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "1011_staffing_requirements_draft_meta"
down_revision = "1010_employee_availability"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
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
    op.create_index("ix_staffing_requirements_company_id", "staffing_requirements", ["company_id"])
    op.create_index("ix_staffing_requirements_date", "staffing_requirements", ["date"])
    op.create_index(
        "ix_staffing_requirements_company_date",
        "staffing_requirements",
        ["company_id", "date"],
    )

    op.add_column(
        "pulse_schedule_shifts",
        sa.Column("locked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "pulse_schedule_shifts",
        sa.Column("generated_by", sa.String(64), nullable=True),
    )
    op.add_column(
        "pulse_schedule_shifts",
        sa.Column("confidence_score", sa.Float(), nullable=True),
    )
    op.add_column(
        "pulse_schedule_shifts",
        sa.Column("recommendation_reason", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("pulse_schedule_shifts", "recommendation_reason")
    op.drop_column("pulse_schedule_shifts", "confidence_score")
    op.drop_column("pulse_schedule_shifts", "generated_by")
    op.drop_column("pulse_schedule_shifts", "locked")
    op.drop_index("ix_staffing_requirements_company_date", table_name="staffing_requirements")
    op.drop_index("ix_staffing_requirements_date", table_name="staffing_requirements")
    op.drop_index("ix_staffing_requirements_company_id", table_name="staffing_requirements")
    op.drop_table("staffing_requirements")
