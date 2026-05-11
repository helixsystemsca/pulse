"""Optional matrix display override for procedure training assignments (company admin)."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0111_training_matrix_admin_override"
down_revision = "0110_procedure_verification"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "pulse_procedure_training_assignments",
        sa.Column("matrix_admin_override", sa.String(length=20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("pulse_procedure_training_assignments", "matrix_admin_override")
