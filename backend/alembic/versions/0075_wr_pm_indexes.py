"""Composite indexes + pm_tasks.company_id for scale

Revision ID: 0075_wr_pm_indexes
Revises: 0074_migrate_prev_to_pm
Create Date: 2026-04-26
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0075_wr_pm_indexes"
down_revision = "0074_migrate_prev_to_pm"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Work requests: common filters are company+status and company+assignee.
    op.create_index(
        "ix_wr_company_status",
        "pulse_work_requests",
        ["company_id", "status"],
    )
    op.create_index(
        "ix_wr_company_assigned",
        "pulse_work_requests",
        ["company_id", "assigned_user_id"],
    )

    # PM tasks: add company_id directly so company-scoped queries don't require a join.
    op.add_column("pm_tasks", sa.Column("company_id", UUID(as_uuid=False), nullable=True))
    op.create_foreign_key(
        "fk_pm_tasks_company_id_companies",
        "pm_tasks",
        "companies",
        ["company_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # Backfill company_id from related asset tables.
    op.execute(
        """
        UPDATE pm_tasks t
        SET company_id = fe.company_id
        FROM facility_equipment fe
        WHERE t.company_id IS NULL
          AND t.equipment_id IS NOT NULL
          AND fe.id = t.equipment_id;
        """
    )
    op.execute(
        """
        UPDATE pm_tasks t
        SET company_id = tl.company_id
        FROM tools tl
        WHERE t.company_id IS NULL
          AND t.tool_id IS NOT NULL
          AND tl.id = t.tool_id;
        """
    )

    # Enforce non-null after backfill.
    op.alter_column("pm_tasks", "company_id", existing_type=UUID(as_uuid=False), nullable=False)
    op.create_index("ix_pm_tasks_company_due", "pm_tasks", ["company_id", "next_due_at"])


def downgrade() -> None:
    op.drop_index("ix_pm_tasks_company_due", table_name="pm_tasks")
    op.alter_column("pm_tasks", "company_id", existing_type=UUID(as_uuid=False), nullable=True)
    op.drop_constraint("fk_pm_tasks_company_id_companies", "pm_tasks", type_="foreignkey")
    op.drop_column("pm_tasks", "company_id")

    op.drop_index("ix_wr_company_assigned", table_name="pulse_work_requests")
    op.drop_index("ix_wr_company_status", table_name="pulse_work_requests")

