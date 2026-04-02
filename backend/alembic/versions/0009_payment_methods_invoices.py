"""Payment methods and invoices (mock billing — no gateway).

Revision ID: 0009
Revises: 0008
Create Date: 2026-03-31

"""

from pathlib import Path
import sys

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    if not ah.table_exists(conn, "payment_methods"):
        op.create_table(
            "payment_methods",
            sa.Column("id", UUID(as_uuid=False), primary_key=True),
            sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
            sa.Column("type", sa.String(16), nullable=False),
            sa.Column("brand", sa.String(32), nullable=True),
            sa.Column("bank_name", sa.String(255), nullable=True),
            sa.Column("last4", sa.String(4), nullable=False),
            sa.Column("expiry_month", sa.Integer(), nullable=True),
            sa.Column("expiry_year", sa.Integer(), nullable=True),
            sa.Column("rail", sa.String(16), nullable=True),
            sa.Column("holder_name", sa.String(255), nullable=True),
            sa.Column("is_primary", sa.Boolean(), nullable=False, server_default="false"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_payment_methods_company_id", "payment_methods", ["company_id"])

    if not ah.table_exists(conn, "invoices"):
        op.create_table(
            "invoices",
            sa.Column("id", UUID(as_uuid=False), primary_key=True),
            sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
            sa.Column("amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("currency", sa.String(8), nullable=False, server_default="USD"),
            sa.Column("status", sa.String(16), nullable=False),
            sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("reference_number", sa.String(64), nullable=False),
        )
        op.create_index("ix_invoices_company_id", "invoices", ["company_id"])
        op.create_index("ix_invoices_status", "invoices", ["status"])
        op.create_index("ix_invoices_issued_at", "invoices", ["issued_at"])


def downgrade() -> None:
    conn = op.get_bind()
    if ah.table_exists(conn, "invoices"):
        op.drop_table("invoices")
    if ah.table_exists(conn, "payment_methods"):
        op.drop_table("payment_methods")
