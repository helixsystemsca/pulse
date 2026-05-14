"""Append-only RBAC audit events (entitlement / override changes)."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0128_rbac_audit_events"
down_revision = "0127_drop_workspace_view_rbac"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "rbac_audit_events",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", sa.dialects.postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("actor_user_id", sa.dialects.postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("action", sa.String(length=128), nullable=False),
        sa.Column("target_user_id", sa.dialects.postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["target_user_id"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_rbac_audit_events_company_id", "rbac_audit_events", ["company_id"])
    op.create_index("ix_rbac_audit_events_actor_user_id", "rbac_audit_events", ["actor_user_id"])
    op.create_index("ix_rbac_audit_events_target_user_id", "rbac_audit_events", ["target_user_id"])
    op.create_index("ix_rbac_audit_events_action", "rbac_audit_events", ["action"])
    op.create_index("ix_rbac_audit_events_created_at", "rbac_audit_events", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_rbac_audit_events_created_at", table_name="rbac_audit_events")
    op.drop_index("ix_rbac_audit_events_action", table_name="rbac_audit_events")
    op.drop_index("ix_rbac_audit_events_target_user_id", table_name="rbac_audit_events")
    op.drop_index("ix_rbac_audit_events_actor_user_id", table_name="rbac_audit_events")
    op.drop_index("ix_rbac_audit_events_company_id", table_name="rbac_audit_events")
    op.drop_table("rbac_audit_events")
