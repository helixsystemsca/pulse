"""Multi-department workspace assignments on worker HR rows."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0121_pulse_worker_hr_department_slugs"
down_revision = "0120_pulse_procedure_department_category"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "pulse_worker_hr",
        sa.Column("department_slugs", JSONB(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("pulse_worker_hr", "department_slugs")
