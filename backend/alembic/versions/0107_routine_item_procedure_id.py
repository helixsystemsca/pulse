"""Routine checklist lines: optional link to pulse_procedures (SOP library)."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0107_routine_item_procedure_id"
down_revision = "0106_routine_item_shift_band"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "pulse_routine_items",
        sa.Column("procedure_id", UUID(as_uuid=False), nullable=True),
    )
    op.create_foreign_key(
        "fk_pulse_routine_items_procedure_id",
        "pulse_routine_items",
        "pulse_procedures",
        ["procedure_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_pulse_routine_items_procedure_id", "pulse_routine_items", ["procedure_id"])


def downgrade() -> None:
    op.drop_index("ix_pulse_routine_items_procedure_id", table_name="pulse_routine_items")
    op.drop_constraint("fk_pulse_routine_items_procedure_id", "pulse_routine_items", type_="foreignkey")
    op.drop_column("pulse_routine_items", "procedure_id")
