"""CMMS: procedure revision metadata + assignment kind."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

# Must fit alembic_version.version_num (varchar(32)); keep ≤ 32 chars.
revision = "0067_proc_rev_kind"
down_revision = "0066_proc_assign"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "pulse_procedures",
        sa.Column("revised_by_user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )
    op.add_column("pulse_procedures", sa.Column("revised_by_name", sa.String(length=255), nullable=True))
    op.add_column("pulse_procedures", sa.Column("revised_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_pulse_procedures_revised_by_user_id", "pulse_procedures", ["revised_by_user_id"])

    op.add_column(
        "pulse_procedure_assignments",
        sa.Column("kind", sa.String(length=16), nullable=False, server_default="complete"),
    )
    op.create_index("ix_pulse_proc_assign_kind", "pulse_procedure_assignments", ["kind"])


def downgrade() -> None:
    op.drop_index("ix_pulse_proc_assign_kind", table_name="pulse_procedure_assignments")
    op.drop_column("pulse_procedure_assignments", "kind")

    op.drop_index("ix_pulse_procedures_revised_by_user_id", table_name="pulse_procedures")
    op.drop_column("pulse_procedures", "revised_at")
    op.drop_column("pulse_procedures", "revised_by_name")
    op.drop_column("pulse_procedures", "revised_by_user_id")

