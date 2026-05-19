"""Per-day employee availability for auxiliary scheduling (manual builder UX)."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "1010_employee_availability"
down_revision = "1009_inventory_vendor_contractor_department"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "employee_availability",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column(
            "company_id",
            UUID(as_uuid=False),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "employee_id",
            UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("start_time", sa.Time(timezone=False), nullable=True),
        sa.Column("end_time", sa.Time(timezone=False), nullable=True),
        sa.Column("restriction_type", sa.String(32), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("source", sa.String(64), nullable=False, server_default="manual"),
        sa.Column("imported_from", sa.String(128), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_employee_availability_company_id", "employee_availability", ["company_id"])
    op.create_index("ix_employee_availability_employee_id", "employee_availability", ["employee_id"])
    op.create_index("ix_employee_availability_date", "employee_availability", ["date"])
    op.create_index(
        "ix_employee_availability_company_employee_date",
        "employee_availability",
        ["company_id", "employee_id", "date"],
    )
    op.create_unique_constraint(
        "uq_employee_availability_day_slot",
        "employee_availability",
        ["company_id", "employee_id", "date", "status", "restriction_type"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_employee_availability_day_slot", "employee_availability", type_="unique")
    op.drop_index("ix_employee_availability_company_employee_date", table_name="employee_availability")
    op.drop_index("ix_employee_availability_date", table_name="employee_availability")
    op.drop_index("ix_employee_availability_employee_id", table_name="employee_availability")
    op.drop_index("ix_employee_availability_company_id", table_name="employee_availability")
    op.drop_table("employee_availability")
