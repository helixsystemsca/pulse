"""Tenants → companies, hierarchical RBAC, role_permissions, audit_logs.

Revision ID: 0004
Revises: 0003
Create Date: 2026-03-26

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy import text

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- Users: new columns before table renames ---
    op.add_column(
        "users",
        sa.Column("created_by", UUID(as_uuid=False), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.add_column(
        "users",
        sa.Column("permission_deny", JSONB, server_default=sa.text("'[]'::jsonb"), nullable=False),
    )
    op.create_foreign_key("fk_users_created_by", "users", "users", ["created_by"], ["id"], ondelete="SET NULL")

    op.execute(text("ALTER TABLE tenants RENAME TO companies"))

    # Rename tenant_id → company_id on all referencing tables
    for tbl in (
        "users",
        "zones",
        "tools",
        "domain_events",
        "inventory_items",
        "jobs",
        "maintenance_schedules",
        "maintenance_logs",
        "notification_rules",
    ):
        op.execute(text(f'ALTER TABLE "{tbl}" RENAME COLUMN tenant_id TO company_id'))

    op.add_column(
        "companies",
        sa.Column("owner_admin_id", UUID(as_uuid=False), nullable=True),
    )
    op.create_foreign_key(
        "fk_companies_owner_admin",
        "companies",
        "users",
        ["owner_admin_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.execute(text("ALTER TABLE users ALTER COLUMN company_id DROP NOT NULL"))

    # Global unique email (login)
    op.drop_constraint("uq_user_tenant_email", "users", type_="unique")
    op.create_index("uq_users_email", "users", ["email"], unique=True)

    # Role: PG enum admin/worker → varchar with new values
    op.execute(
        text(
            """
            ALTER TABLE users
            ALTER COLUMN role TYPE VARCHAR(32)
            USING (
              CASE role::text
                WHEN 'admin' THEN 'company_admin'
                WHEN 'worker' THEN 'worker'
                ELSE 'worker'
              END
            )
            """
        )
    )
    op.execute(text("DROP TYPE IF EXISTS userrole"))

    op.execute(
        text(
            """
            UPDATE notification_rules
            SET target_role = 'company_admin'
            WHERE target_role = 'admin'
            """
        )
    )

    # Rename unique constraint on tools if present
    op.execute(
        text(
            """
            DO $$
            BEGIN
              IF EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'uq_tool_tenant_tag'
              ) THEN
                ALTER TABLE tools RENAME CONSTRAINT uq_tool_tenant_tag TO uq_tool_company_tag;
              END IF;
            END $$;
            """
        )
    )

    op.create_table(
        "role_permissions",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("permissions", JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("company_id", "role", name="uq_role_permissions_company_role"),
    )
    op.create_index("ix_role_permissions_company_id", "role_permissions", ["company_id"])

    op.create_table(
        "audit_logs",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("actor_user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(length=128), nullable=False),
        sa.Column("metadata", JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_audit_logs_actor_user_id", "audit_logs", ["actor_user_id"])
    op.create_index("ix_audit_logs_company_id", "audit_logs", ["company_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])

    op.execute(
        text(
            """
            UPDATE companies c
            SET owner_admin_id = u.id
            FROM users u
            WHERE u.company_id = c.id AND u.role = 'company_admin'
            AND c.owner_admin_id IS NULL
            AND u.id = (
              SELECT u2.id FROM users u2
              WHERE u2.company_id = c.id AND u2.role = 'company_admin'
              ORDER BY u2.created_at NULLS LAST
              LIMIT 1
            )
            """
        )
    )


def downgrade() -> None:
    raise NotImplementedError("Downgrade not supported for RBAC migration")
