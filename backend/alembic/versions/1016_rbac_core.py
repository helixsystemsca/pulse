"""Ensure RBAC catalog/role tables exist on fresh DBs (idempotent; archived chain had 0123)."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1016_rbac_core"
down_revision = "1015_version_num_128"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_create_table(
        op,
        conn,
        "rbac_catalog_permissions",
        sa.Column("key", sa.String(160), primary_key=True, nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
    )
    ah.safe_create_table(
        op,
        conn,
        "tenant_departments",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("slug", sa.String(64), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("timezone('utc', now())"),
        ),
        sa.UniqueConstraint("company_id", "slug", name="uq_tenant_departments_company_slug"),
    )
    ah.safe_create_index(op, conn, "ix_tenant_departments_company_id", "tenant_departments", ["company_id"])
    ah.safe_create_table(
        op,
        conn,
        "tenant_roles",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "department_id",
            UUID(as_uuid=False),
            sa.ForeignKey("tenant_departments.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("slug", sa.String(96), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("feature_keys", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("timezone('utc', now())"),
        ),
        sa.UniqueConstraint("company_id", "slug", name="uq_tenant_roles_company_slug"),
    )
    ah.safe_create_index(op, conn, "ix_tenant_roles_company_id", "tenant_roles", ["company_id"])
    ah.safe_create_index(op, conn, "ix_tenant_roles_department_id", "tenant_roles", ["department_id"])
    ah.safe_create_table(
        op,
        conn,
        "tenant_role_grants",
        sa.Column("tenant_role_id", UUID(as_uuid=False), sa.ForeignKey("tenant_roles.id", ondelete="CASCADE"), primary_key=True),
        sa.Column(
            "permission_key",
            sa.String(160),
            sa.ForeignKey("rbac_catalog_permissions.key", ondelete="CASCADE"),
            primary_key=True,
        ),
    )
    ah.safe_create_table(
        op,
        conn,
        "rbac_audit_events",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=True),
        sa.Column("actor_user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("action", sa.String(128), nullable=False),
        sa.Column("target_user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("payload", JSONB, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("timezone('utc', now())"),
        ),
    )
    ah.safe_create_index(op, conn, "ix_rbac_audit_events_company_id", "rbac_audit_events", ["company_id"])
    ah.safe_create_index(op, conn, "ix_rbac_audit_events_actor_user_id", "rbac_audit_events", ["actor_user_id"])
    ah.safe_create_index(op, conn, "ix_rbac_audit_events_action", "rbac_audit_events", ["action"])
    ah.safe_create_index(op, conn, "ix_rbac_audit_events_created_at", "rbac_audit_events", ["created_at"])


def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, "ix_rbac_audit_events_created_at", "rbac_audit_events")
    ah.safe_drop_index(op, conn, "ix_rbac_audit_events_action", "rbac_audit_events")
    ah.safe_drop_index(op, conn, "ix_rbac_audit_events_actor_user_id", "rbac_audit_events")
    ah.safe_drop_index(op, conn, "ix_rbac_audit_events_company_id", "rbac_audit_events")
    ah.safe_drop_table(op, conn, "rbac_audit_events")
    ah.safe_drop_table(op, conn, "tenant_role_grants")
    ah.safe_drop_index(op, conn, "ix_tenant_roles_department_id", "tenant_roles")
    ah.safe_drop_index(op, conn, "ix_tenant_roles_company_id", "tenant_roles")
    ah.safe_drop_table(op, conn, "tenant_roles")
    ah.safe_drop_index(op, conn, "ix_tenant_departments_company_id", "tenant_departments")
    ah.safe_drop_table(op, conn, "tenant_departments")
    ah.safe_drop_table(op, conn, "rbac_catalog_permissions")
