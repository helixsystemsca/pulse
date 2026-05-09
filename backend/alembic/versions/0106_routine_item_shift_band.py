"""Routine checklist items: optional shift band (day / afternoon / night)."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0106_routine_item_shift_band"
down_revision = "0105_pulse_procedure_training"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "pulse_routine_items",
        sa.Column("shift_band", sa.String(length=16), nullable=True),
    )
    op.create_index(
        "ix_pulse_routine_items_routine_shift_band",
        "pulse_routine_items",
        ["routine_id", "shift_band"],
    )


def downgrade() -> None:
    op.drop_index("ix_pulse_routine_items_routine_shift_band", table_name="pulse_routine_items")
    op.drop_column("pulse_routine_items", "shift_band")
