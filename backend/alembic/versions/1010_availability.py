"""Per-day employee availability for auxiliary scheduling (manual builder UX)."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1010_availability"
down_revision = "1009_vendor_scope"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_create_table(
        op,
        conn,
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
    ah.safe_create_index(op, conn, "ix_employee_availability_company_id", "employee_availability", ["company_id"])
    ah.safe_create_index(op, conn, "ix_employee_availability_employee_id", "employee_availability", ["employee_id"])
    ah.safe_create_index(op, conn, "ix_employee_availability_date", "employee_availability", ["date"])
    ah.safe_create_index(
        op,
        conn,
        "ix_employee_availability_company_employee_date",
        "employee_availability",
        ["company_id", "employee_id", "date"],
    )
    ah.safe_create_unique_constraint(
        op,
        conn,
        "uq_employee_availability_day_slot",
        "employee_availability",
        ["company_id", "employee_id", "date", "status", "restriction_type"],
    )


def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_constraint(op, conn, "uq_employee_availability_day_slot", "employee_availability", type_="unique")
    ah.safe_drop_index(op, conn, "ix_employee_availability_company_employee_date", "employee_availability")
    ah.safe_drop_index(op, conn, "ix_employee_availability_date", "employee_availability")
    ah.safe_drop_index(op, conn, "ix_employee_availability_employee_id", "employee_availability")
    ah.safe_drop_index(op, conn, "ix_employee_availability_company_id", "employee_availability")
    ah.safe_drop_table(op, conn, "employee_availability")
