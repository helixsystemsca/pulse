"""Automation device hub: gateways, BLE devices, event company_id, notification company_id, zones.description.

Revision ID: 0014
Revises: 0013
Create Date: 2026-03-30
"""

from pathlib import Path
import sys

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import JSONB, UUID

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    if ah.table_exists(conn, "automation_events") and not ah.column_exists(conn, "automation_events", "company_id"):
        op.add_column(
            "automation_events",
            sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=True),
        )
        op.create_index("ix_automation_events_company_id", "automation_events", ["company_id"])

    if ah.table_exists(conn, "automation_notifications") and not ah.column_exists(
        conn, "automation_notifications", "company_id"
    ):
        op.add_column(
            "automation_notifications",
            sa.Column(
                "company_id",
                UUID(as_uuid=False),
                sa.ForeignKey("companies.id", ondelete="CASCADE"),
                nullable=True,
            ),
        )
        op.execute(
            text(
                """
                UPDATE automation_notifications AS an
                SET company_id = u.company_id
                FROM users AS u
                WHERE an.user_id = u.id AND u.company_id IS NOT NULL
                """
            )
        )
        op.execute(text("DELETE FROM automation_notifications WHERE company_id IS NULL"))
        op.execute(text("ALTER TABLE automation_notifications ALTER COLUMN company_id SET NOT NULL"))
        op.create_index("ix_automation_notifications_company_id", "automation_notifications", ["company_id"])

    if ah.table_exists(conn, "zones") and not ah.column_exists(conn, "zones", "description"):
        op.add_column("zones", sa.Column("description", sa.Text(), nullable=True))

    if not ah.table_exists(conn, "automation_gateways"):
        op.create_table(
            "automation_gateways",
            sa.Column("id", UUID(as_uuid=False), primary_key=True),
            sa.Column(
                "company_id",
                UUID(as_uuid=False),
                sa.ForeignKey("companies.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("identifier", sa.String(128), nullable=False),
            sa.Column("status", sa.String(32), server_default="offline", nullable=False),
            sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "zone_id",
                UUID(as_uuid=False),
                sa.ForeignKey("zones.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.UniqueConstraint("company_id", "identifier", name="uq_automation_gateway_company_identifier"),
        )
        op.create_index("ix_automation_gateways_company_id", "automation_gateways", ["company_id"])
        op.create_index("ix_automation_gateways_identifier", "automation_gateways", ["identifier"])
        op.create_index("ix_automation_gateways_status", "automation_gateways", ["status"])
        op.create_index("ix_automation_gateways_zone_id", "automation_gateways", ["zone_id"])

    if not ah.table_exists(conn, "automation_ble_devices"):
        op.create_table(
            "automation_ble_devices",
            sa.Column("id", UUID(as_uuid=False), primary_key=True),
            sa.Column(
                "company_id",
                UUID(as_uuid=False),
                sa.ForeignKey("companies.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("mac_address", sa.String(32), nullable=False),
            sa.Column("type", sa.String(32), nullable=False),
            sa.Column(
                "assigned_worker_id",
                UUID(as_uuid=False),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column(
                "assigned_equipment_id",
                UUID(as_uuid=False),
                sa.ForeignKey("tools.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.UniqueConstraint("company_id", "mac_address", name="uq_automation_ble_company_mac"),
        )
        op.create_index("ix_automation_ble_devices_company_id", "automation_ble_devices", ["company_id"])
        op.create_index("ix_automation_ble_devices_mac_address", "automation_ble_devices", ["mac_address"])
        op.create_index("ix_automation_ble_devices_type", "automation_ble_devices", ["type"])
        op.create_index("ix_automation_ble_devices_assigned_worker_id", "automation_ble_devices", ["assigned_worker_id"])
        op.create_index(
            "ix_automation_ble_devices_assigned_equipment_id",
            "automation_ble_devices",
            ["assigned_equipment_id"],
        )


def downgrade() -> None:
    conn = op.get_bind()

    if ah.table_exists(conn, "automation_ble_devices"):
        op.drop_table("automation_ble_devices")

    if ah.table_exists(conn, "automation_gateways"):
        op.drop_table("automation_gateways")

    if ah.table_exists(conn, "zones") and ah.column_exists(conn, "zones", "description"):
        op.drop_column("zones", "description")

    if ah.table_exists(conn, "automation_notifications") and ah.column_exists(
        conn, "automation_notifications", "company_id"
    ):
        op.drop_index("ix_automation_notifications_company_id", table_name="automation_notifications")
        op.drop_constraint("fk_automation_notifications_company_id", "automation_notifications", type_="foreignkey")
        op.drop_column("automation_notifications", "company_id")

    if ah.table_exists(conn, "automation_events") and ah.column_exists(conn, "automation_events", "company_id"):
        op.drop_index("ix_automation_events_company_id", table_name="automation_events")
        op.drop_column("automation_events", "company_id")
