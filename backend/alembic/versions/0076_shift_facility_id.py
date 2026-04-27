"""pulse_schedule_shifts: rename zone_id -> facility_id

Revision ID: 0076_shift_facility
Revises: 0075_wr_pm_indexes
Create Date: 2026-04-26
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0076_shift_facility"
down_revision = "0075_wr_pm_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new column, copy values, then drop old column + indexes/FK.
    op.add_column("pulse_schedule_shifts", sa.Column("facility_id", UUID(as_uuid=False), nullable=True))
    op.create_foreign_key(
        "fk_pulse_schedule_shifts_facility_id_zones",
        "pulse_schedule_shifts",
        "zones",
        ["facility_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # Copy data across (safe if zone_id doesn't exist in some envs).
    op.execute(
        """
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'pulse_schedule_shifts'
              AND column_name = 'zone_id'
          ) THEN
            EXECUTE 'UPDATE pulse_schedule_shifts SET facility_id = zone_id WHERE facility_id IS NULL';
          END IF;
        END $$;
        """
    )

    op.create_index("ix_pulse_schedule_shifts_facility_id", "pulse_schedule_shifts", ["facility_id"])

    # Drop old FK/index/column (idempotent-ish via IF EXISTS).
    op.execute("DROP INDEX IF EXISTS ix_pulse_schedule_shifts_zone_id;")
    op.execute("ALTER TABLE pulse_schedule_shifts DROP CONSTRAINT IF EXISTS fk_pulse_schedule_shifts_zone_id_zones;")
    op.execute("ALTER TABLE pulse_schedule_shifts DROP CONSTRAINT IF EXISTS pulse_schedule_shifts_zone_id_fkey;")
    op.execute("ALTER TABLE pulse_schedule_shifts DROP COLUMN IF EXISTS zone_id;")


def downgrade() -> None:
    op.add_column("pulse_schedule_shifts", sa.Column("zone_id", UUID(as_uuid=False), nullable=True))
    op.execute(
        """
        UPDATE pulse_schedule_shifts
        SET zone_id = facility_id
        WHERE zone_id IS NULL;
        """
    )
    op.create_foreign_key(
        "fk_pulse_schedule_shifts_zone_id_zones",
        "pulse_schedule_shifts",
        "zones",
        ["zone_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_pulse_schedule_shifts_zone_id", "pulse_schedule_shifts", ["zone_id"])

    op.drop_index("ix_pulse_schedule_shifts_facility_id", table_name="pulse_schedule_shifts")
    op.drop_constraint("fk_pulse_schedule_shifts_facility_id_zones", "pulse_schedule_shifts", type_="foreignkey")
    op.drop_column("pulse_schedule_shifts", "facility_id")

