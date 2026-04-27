"""pm_tasks: add tool_id FK (dual-track assets)

Revision ID: 0072_pm_tasks_tool_id
Revises: 0071_maint_inf_created_at_idx
Create Date: 2026-04-26
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0072_pm_tasks_tool_id"
down_revision = "0071_maint_inf_created_at_idx"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Allow PMs to target either facility_equipment (fixed assets) or tools (BLE-tracked).
    op.add_column("pm_tasks", sa.Column("tool_id", UUID(as_uuid=False), nullable=True))
    op.create_foreign_key(
        "fk_pm_tasks_tool_id_tools",
        "pm_tasks",
        "tools",
        ["tool_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_pm_tasks_tool_id", "pm_tasks", ["tool_id"])

    # Existing schema requires equipment_id; make it optional and enforce "exactly one" via check constraint.
    op.alter_column("pm_tasks", "equipment_id", existing_type=UUID(as_uuid=False), nullable=True)
    op.create_check_constraint(
        "ck_pm_tasks_one_asset",
        "pm_tasks",
        "(equipment_id IS NOT NULL AND tool_id IS NULL) OR (equipment_id IS NULL AND tool_id IS NOT NULL)",
    )


def downgrade() -> None:
    op.drop_constraint("ck_pm_tasks_one_asset", "pm_tasks", type_="check")
    op.alter_column("pm_tasks", "equipment_id", existing_type=UUID(as_uuid=False), nullable=False)

    op.drop_index("ix_pm_tasks_tool_id", table_name="pm_tasks")
    op.drop_constraint("fk_pm_tasks_tool_id_tools", "pm_tasks", type_="foreignkey")
    op.drop_column("pm_tasks", "tool_id")

