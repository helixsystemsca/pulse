"""Equipment parts master list, equipment/part images, work request part_id."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0032"
down_revision = "0031"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("facility_equipment", sa.Column("image_url", sa.String(length=2048), nullable=True))
    op.create_table(
        "equipment_parts",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column(
            "company_id",
            UUID(as_uuid=False),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "equipment_id",
            UUID(as_uuid=False),
            sa.ForeignKey("facility_equipment.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("replacement_interval_days", sa.Integer(), nullable=True),
        sa.Column("last_replaced_date", sa.Date(), nullable=True),
        sa.Column("next_replacement_date", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("image_url", sa.String(length=2048), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_equipment_parts_company_id", "equipment_parts", ["company_id"])
    op.create_index("ix_equipment_parts_equipment_id", "equipment_parts", ["equipment_id"])
    op.add_column(
        "pulse_work_requests",
        sa.Column(
            "part_id",
            UUID(as_uuid=False),
            sa.ForeignKey("equipment_parts.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_pulse_work_requests_part_id", "pulse_work_requests", ["part_id"])


def downgrade() -> None:
    op.drop_index("ix_pulse_work_requests_part_id", table_name="pulse_work_requests")
    op.drop_column("pulse_work_requests", "part_id")
    op.drop_index("ix_equipment_parts_equipment_id", table_name="equipment_parts")
    op.drop_index("ix_equipment_parts_company_id", table_name="equipment_parts")
    op.drop_table("equipment_parts")
    op.drop_column("facility_equipment", "image_url")
