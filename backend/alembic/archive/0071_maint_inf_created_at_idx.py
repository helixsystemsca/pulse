"""maintenance_inferences created_at index for TTL cleanup

Revision ID: 0071_maint_inf_created_at_idx
Revises: 0070_pulse_config
Create Date: 2026-04-26
"""

from alembic import op

# Alembic version_num column is VARCHAR(32) in this project, so keep revision ids short.
revision = "0071_maint_inf_created_at_idx"
down_revision = "0070_pulse_config"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Some environments may not have this table (e.g. partial dumps / dev DBs). Make the migration
    # tolerant by checking table existence first.
    op.execute(
        """
        DO $$
        BEGIN
          IF to_regclass('public.maintenance_inferences') IS NOT NULL THEN
            EXECUTE 'CREATE INDEX IF NOT EXISTS ix_maintenance_inferences_created_at ON maintenance_inferences (created_at)';
          END IF;
        END
        $$;
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_maintenance_inferences_created_at;")

