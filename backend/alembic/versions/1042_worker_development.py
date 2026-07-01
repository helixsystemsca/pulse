"""Employee development profiles — quadrant matrix, plans, timeline, history."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1042_worker_development"
down_revision = "1041_training_platform"
branch_labels = None
depends_on = None

_TS = sa.text("timezone('utc', now())")


def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_create_table(
        op,
        conn,
        "pulse_worker_development",
        sa.Column("user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column(
            "company_id",
            UUID(as_uuid=False),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("development_quadrant", sa.String(1), nullable=False, server_default=sa.text("'C'")),
        sa.Column("development_status", sa.String(32), nullable=False, server_default=sa.text("'developing'")),
        sa.Column("last_assessment_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_review_date", sa.Date(), nullable=True),
        sa.Column("manager_notes", sa.Text(), nullable=True),
        sa.Column("career_goals", sa.Text(), nullable=True),
        sa.Column("assessment", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("development_plan", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("skills", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("timeline", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("history", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
    )
    ah.safe_create_index(op, conn, "ix_pulse_worker_development_company_id", "pulse_worker_development", ["company_id"])


def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_table(op, conn, "pulse_worker_development")
