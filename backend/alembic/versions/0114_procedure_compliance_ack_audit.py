"""Procedure compliance metadata + immutable acknowledgment audit fields."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0114_procedure_compliance_ack_audit"
down_revision = "0113_operational_xp_recognition"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "pulse_procedures",
        sa.Column("procedure_category", sa.String(length=128), nullable=True),
    )
    op.add_column(
        "pulse_procedures",
        sa.Column("semantic_version", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "pulse_procedures",
        sa.Column("revision_date", sa.Date(), nullable=True),
    )
    op.add_column(
        "pulse_procedures",
        sa.Column("publication_state", sa.String(length=20), nullable=False, server_default="published"),
    )
    op.add_column(
        "pulse_procedures",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.add_column(
        "pulse_procedures",
        sa.Column("requires_reacknowledgment", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )

    op.add_column(
        "pulse_procedure_acknowledgements",
        sa.Column("acknowledgment_statement", sa.Text(), nullable=True),
    )
    op.add_column(
        "pulse_procedure_acknowledgements",
        sa.Column("acknowledgment_note", sa.String(length=2000), nullable=True),
    )
    op.create_index(
        "ix_pulse_proc_ack_company_ack_at",
        "pulse_procedure_acknowledgements",
        ["company_id", "acknowledged_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_pulse_proc_ack_company_ack_at", table_name="pulse_procedure_acknowledgements")
    op.drop_column("pulse_procedure_acknowledgements", "acknowledgment_note")
    op.drop_column("pulse_procedure_acknowledgements", "acknowledgment_statement")
    op.drop_column("pulse_procedures", "requires_reacknowledgment")
    op.drop_column("pulse_procedures", "is_active")
    op.drop_column("pulse_procedures", "publication_state")
    op.drop_column("pulse_procedures", "revision_date")
    op.drop_column("pulse_procedures", "semantic_version")
    op.drop_column("pulse_procedures", "procedure_category")
