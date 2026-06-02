"""Material request template exports and queue export metadata."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1033_material_request_template_export"
down_revision = "1032_purchasing_module"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    if not ah.table_exists(conn, "material_request_exports"):
        ah.safe_create_table(
            op,
            conn,
            "material_request_exports",
            sa.Column("id", UUID(as_uuid=False), primary_key=True),
            sa.Column(
                "company_id",
                UUID(as_uuid=False),
                sa.ForeignKey("companies.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "created_by_user_id",
                UUID(as_uuid=False),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.Column("project", sa.String(255), nullable=False),
            sa.Column("location", sa.String(512), nullable=False),
            sa.Column("cost_object", sa.String(255), nullable=True),
            sa.Column("comments", sa.Text(), nullable=True),
            sa.Column("item_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("file_name", sa.String(255), nullable=False),
        )
        ah.safe_create_index(
            op, conn, "ix_material_request_exports_company_id", "material_request_exports", ["company_id"]
        )
        ah.safe_create_index(
            op,
            conn,
            "ix_material_request_exports_created_at",
            "material_request_exports",
            ["created_at"],
        )

    if ah.table_exists(conn, "material_request_queue"):
        ah.safe_add_column(op, conn, "material_request_queue", sa.Column("vendor_part_number", sa.String(128), nullable=True))
        ah.safe_add_column(op, conn, "material_request_queue", sa.Column("unit", sa.String(32), nullable=True))
        ah.safe_add_column(op, conn, "material_request_queue", sa.Column("reimbursable", sa.Boolean(), nullable=True))
        ah.safe_add_column(
            op, conn, "material_request_queue", sa.Column("exported_at", sa.DateTime(timezone=True), nullable=True)
        )
        ah.safe_add_column(
            op,
            conn,
            "material_request_queue",
            sa.Column(
                "export_batch_id",
                UUID(as_uuid=False),
                sa.ForeignKey("material_request_exports.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )
        ah.safe_create_index(
            op,
            conn,
            "ix_material_request_queue_export_batch_id",
            "material_request_queue",
            ["export_batch_id"],
        )


def downgrade() -> None:
    conn = op.get_bind()
    if ah.table_exists(conn, "material_request_queue"):
        for col in ("export_batch_id", "exported_at", "reimbursable", "unit", "vendor_part_number"):
            ah.safe_drop_column(op, conn, "material_request_queue", col)
    if ah.table_exists(conn, "material_request_exports"):
        ah.safe_drop_table(op, conn, "material_request_exports")
