"""Automation unknown BLE MAC observability (unregistered tags).

Revision ID: 0015
Revises: 0014
Create Date: 2026-03-30
"""

from pathlib import Path
import sys

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import UUID

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    if not ah.table_exists(conn, "automation_unknown_devices"):
        op.create_table(
            "automation_unknown_devices",
            sa.Column("id", UUID(as_uuid=False), primary_key=True),
            sa.Column(
                "company_id",
                UUID(as_uuid=False),
                sa.ForeignKey("companies.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("mac_address", sa.String(32), nullable=False),
            sa.Column("first_seen_at", sa.DateTime(timezone=True), server_default=text("now()"), nullable=False),
            sa.Column("last_seen_at", sa.DateTime(timezone=True), server_default=text("now()"), nullable=False),
            sa.Column("seen_count", sa.Integer(), server_default=text("1"), nullable=False),
            sa.UniqueConstraint("company_id", "mac_address", name="uq_automation_unknown_company_mac"),
        )
        op.create_index("ix_automation_unknown_devices_company_id", "automation_unknown_devices", ["company_id"])
        op.create_index("ix_automation_unknown_devices_mac_address", "automation_unknown_devices", ["mac_address"])


def downgrade() -> None:
    conn = op.get_bind()
    if ah.table_exists(conn, "automation_unknown_devices"):
        op.drop_table("automation_unknown_devices")
