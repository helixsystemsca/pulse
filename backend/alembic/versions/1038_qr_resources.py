"""QR resources table for generic platform QR linking."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1038_qr_resources"
down_revision = "1037_inventory_reorder_outputs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    if ah.table_exists(conn, "qr_resources"):
        return
    ah.safe_create_table(
        op,
        conn,
        "qr_resources",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column(
            "company_id",
            UUID(as_uuid=False),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("resource_type", sa.String(64), nullable=False),
        sa.Column("resource_id", sa.String(64), nullable=False),
        sa.Column("qr_token", sa.String(32), nullable=False),
        sa.Column("guest_access_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("guest_access_level", sa.String(32), nullable=False, server_default="none"),
        sa.Column(
            "created_by_user_id",
            UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    ah.safe_create_index(op, conn, "ix_qr_resources_company_id", "qr_resources", ["company_id"])
    ah.safe_create_index(op, conn, "ix_qr_resources_resource_type", "qr_resources", ["resource_type"])
    ah.safe_create_index(op, conn, "ix_qr_resources_resource_id", "qr_resources", ["resource_id"])
    ah.safe_create_index(op, conn, "uq_qr_resources_qr_token", "qr_resources", ["qr_token"], unique=True)
    ah.safe_create_index(op, conn, "ix_qr_resources_created_at", "qr_resources", ["created_at"])


def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_table(op, conn, "qr_resources")
