"""pulse_schedule_shifts: rename zone_id -> facility_id

Revision ID: 0076_shift_facility
Revises: 0075_wr_pm_indexes
Create Date: 2026-04-26
"""
from __future__ import annotations
import sqlalchemy as sa
from alembic import op

from pathlib import Path
import sys

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

from sqlalchemy.dialects.postgresql import UUID
revision = '0076_shift_facility'
down_revision = '0075_wr_pm_indexes'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'pulse_schedule_shifts', sa.Column('facility_id', UUID(as_uuid=False), nullable=True))
    ah.safe_create_foreign_key(op, conn, 'fk_pulse_schedule_shifts_facility_id_zones', 'pulse_schedule_shifts', 'zones', ['facility_id'], ['id'], ondelete='SET NULL')
    op.execute("\n        DO $$\n        BEGIN\n          IF EXISTS (\n            SELECT 1\n            FROM information_schema.columns\n            WHERE table_name = 'pulse_schedule_shifts'\n              AND column_name = 'zone_id'\n          ) THEN\n            EXECUTE 'UPDATE pulse_schedule_shifts SET facility_id = zone_id WHERE facility_id IS NULL';\n          END IF;\n        END $$;\n        ")
    ah.safe_create_index(op, conn, 'ix_pulse_schedule_shifts_facility_id', 'pulse_schedule_shifts', ['facility_id'])
    op.execute('DROP INDEX IF EXISTS ix_pulse_schedule_shifts_zone_id;')
    op.execute('ALTER TABLE pulse_schedule_shifts DROP CONSTRAINT IF EXISTS fk_pulse_schedule_shifts_zone_id_zones;')
    op.execute('ALTER TABLE pulse_schedule_shifts DROP CONSTRAINT IF EXISTS pulse_schedule_shifts_zone_id_fkey;')
    op.execute('ALTER TABLE pulse_schedule_shifts DROP COLUMN IF EXISTS zone_id;')

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'pulse_schedule_shifts', sa.Column('zone_id', UUID(as_uuid=False), nullable=True))
    op.execute('\n        UPDATE pulse_schedule_shifts\n        SET zone_id = facility_id\n        WHERE zone_id IS NULL;\n        ')
    ah.safe_create_foreign_key(op, conn, 'fk_pulse_schedule_shifts_zone_id_zones', 'pulse_schedule_shifts', 'zones', ['zone_id'], ['id'], ondelete='SET NULL')
    ah.safe_create_index(op, conn, 'ix_pulse_schedule_shifts_zone_id', 'pulse_schedule_shifts', ['zone_id'])
    ah.safe_drop_index(op, conn, 'ix_pulse_schedule_shifts_facility_id', 'pulse_schedule_shifts')
    ah.safe_drop_constraint(op, conn, 'fk_pulse_schedule_shifts_facility_id_zones', 'pulse_schedule_shifts', type_='foreignkey')
    ah.safe_drop_column(op, conn, 'pulse_schedule_shifts', 'facility_id')
