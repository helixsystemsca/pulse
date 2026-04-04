"""Equipment maintenance fields + work order equipment_id FK."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0031"
down_revision = "0030"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("facility_equipment", sa.Column("next_service_date", sa.Date(), nullable=True))
    op.add_column("facility_equipment", sa.Column("service_interval_days", sa.Integer(), nullable=True))
    op.add_column(
        "pulse_work_requests",
        sa.Column(
            "equipment_id",
            UUID(as_uuid=False),
            sa.ForeignKey("facility_equipment.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_pulse_work_requests_equipment_id", "pulse_work_requests", ["equipment_id"])


def downgrade() -> None:
    op.drop_index("ix_pulse_work_requests_equipment_id", table_name="pulse_work_requests")
    op.drop_column("pulse_work_requests", "equipment_id")
    op.drop_column("facility_equipment", "service_interval_days")
    op.drop_column("facility_equipment", "next_service_date")
