"""Procedure compliance: tracking tags + onboarding scope flag."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0116_procedure_compliance_tracking_tags"
down_revision = "0115_procedure_acknowledgment_snapshots_pdf"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "pulse_procedure_compliance_settings",
        sa.Column("tracking_tags", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
    )
    op.add_column(
        "pulse_procedure_compliance_settings",
        sa.Column(
            "onboarding_required",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("pulse_procedure_compliance_settings", "onboarding_required")
    op.drop_column("pulse_procedure_compliance_settings", "tracking_tags")
