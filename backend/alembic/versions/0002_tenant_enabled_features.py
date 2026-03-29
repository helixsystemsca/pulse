"""Move feature flags to tenants.enabled_features; drop tenant_modules when present.

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-26

"""

from alembic import op
from sqlalchemy import text

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        text(
            "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS enabled_features JSONB NOT NULL DEFAULT '[]'::jsonb"
        )
    )
    op.execute(
        text("""
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'tenant_modules'
          ) THEN
            UPDATE tenants t
            SET enabled_features = COALESCE(
              (
                SELECT jsonb_agg(m.module_key ORDER BY m.module_key)
                FROM tenant_modules m
                WHERE m.tenant_id = t.id AND m.enabled = TRUE
              ),
              '[]'::jsonb
            );
            DROP TABLE tenant_modules;
          END IF;
        END $$;
        """)
    )


def downgrade() -> None:
    # Legacy restore not required for scaffold; `enabled_features` remains.
    pass
