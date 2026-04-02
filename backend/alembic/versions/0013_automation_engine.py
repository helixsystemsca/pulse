"""Automation engine: events, feature configs, state tracking, notifications.

Revision ID: 0013
Revises: 0012
Create Date: 2026-04-10
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

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    if not ah.table_exists(conn, "automation_events"):
        op.create_table(
            "automation_events",
            sa.Column("id", UUID(as_uuid=False), primary_key=True),
            sa.Column("event_type", sa.String(128), nullable=False),
            sa.Column("payload", JSONB, nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=text("now()"), nullable=False),
        )
        op.create_index("ix_automation_events_event_type", "automation_events", ["event_type"])
        op.create_index("ix_automation_events_created_at", "automation_events", ["created_at"])

    if not ah.table_exists(conn, "automation_feature_configs"):
        op.create_table(
            "automation_feature_configs",
            sa.Column("id", UUID(as_uuid=False), primary_key=True),
            sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
            sa.Column("feature_name", sa.String(128), nullable=False),
            sa.Column("enabled", sa.Boolean(), server_default=text("true"), nullable=False),
            sa.Column("config", JSONB, server_default=text("'{}'::jsonb"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=text("now()"), nullable=False),
            sa.UniqueConstraint("company_id", "feature_name", name="uq_automation_feature_config_company_name"),
        )
        op.create_index("ix_automation_feature_configs_company_id", "automation_feature_configs", ["company_id"])
        op.create_index("ix_automation_feature_configs_feature_name", "automation_feature_configs", ["feature_name"])

    if not ah.table_exists(conn, "automation_state_tracking"):
        op.create_table(
            "automation_state_tracking",
            sa.Column("id", UUID(as_uuid=False), primary_key=True),
            sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
            sa.Column("entity_key", sa.String(512), nullable=False),
            sa.Column("state", JSONB, server_default=text("'{}'::jsonb"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=text("now()"), nullable=False),
            sa.UniqueConstraint("company_id", "entity_key", name="uq_automation_state_company_entity"),
        )
        op.create_index("ix_automation_state_tracking_company_id", "automation_state_tracking", ["company_id"])
        op.create_index("ix_automation_state_tracking_entity_key", "automation_state_tracking", ["entity_key"])

    if not ah.table_exists(conn, "automation_notifications"):
        op.create_table(
            "automation_notifications",
            sa.Column("id", UUID(as_uuid=False), primary_key=True),
            sa.Column("user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("type", sa.String(64), nullable=False),
            sa.Column("payload", JSONB, server_default=text("'{}'::jsonb"), nullable=False),
            sa.Column("status", sa.String(32), server_default="pending", nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=text("now()"), nullable=False),
        )
        op.create_index("ix_automation_notifications_user_id", "automation_notifications", ["user_id"])
        op.create_index("ix_automation_notifications_type", "automation_notifications", ["type"])
        op.create_index("ix_automation_notifications_status", "automation_notifications", ["status"])
        op.create_index("ix_automation_notifications_created_at", "automation_notifications", ["created_at"])


def downgrade() -> None:
    conn = op.get_bind()
    for t in (
        "automation_notifications",
        "automation_state_tracking",
        "automation_feature_configs",
        "automation_events",
    ):
        if ah.table_exists(conn, t):
            op.drop_table(t)
