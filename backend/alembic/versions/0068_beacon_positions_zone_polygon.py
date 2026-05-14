"""Add beacon_positions table and zone polygon column.

Revision ID: 0068_beacon_positions_zone_polygon
Revises: 0067_proc_rev_kind
Create Date: 2026-04-24

What this adds
--------------
1. beacon_positions  — one row per beacon, upserted on every telemetry ingest batch.
   Stores the latest computed (x, y) position from the RPI5 trilateration engine.
   This is a "current state" table — not a history log. History lives in automation_events.

2. zones.polygon     — JSONB array of normalised {x, y} points defining the zone boundary.
   Used by Shapely for point-in-polygon zone assignment during telemetry ingest.
   The BlueprintDesigner already draws these outlines — this is where they get saved to DB.
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

from sqlalchemy.dialects.postgresql import JSONB, UUID
revision = '0068_beacon_positions'
down_revision = '0067_proc_rev_kind'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_create_table(op, conn, 'beacon_positions', sa.Column('beacon_id', UUID(as_uuid=False), sa.ForeignKey('automation_ble_devices.id', ondelete='CASCADE'), primary_key=True, nullable=False, comment='FK → automation_ble_devices. CASCADE so cleanup is automatic.'), sa.Column('company_id', UUID(as_uuid=False), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False, comment='Denormalised for fast company-scoped queries on the live map.'), sa.Column('x_norm', sa.Float(), nullable=True, comment='Normalised 0.0–1.0 position on floor plan width. Null = position unknown.'), sa.Column('y_norm', sa.Float(), nullable=True, comment='Normalised 0.0–1.0 position on floor plan height.'), sa.Column('zone_id', UUID(as_uuid=False), sa.ForeignKey('zones.id', ondelete='SET NULL'), nullable=True, comment='Zone resolved by polygon lookup. SET NULL if zone is deleted.'), sa.Column('position_confidence', sa.Float(), nullable=True, comment='Trilateration quality 0.0–1.0. Low = few gateways heard this beacon.'), sa.Column('computed_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()'), comment='When the RPI5 position engine last wrote this row.'))
    ah.safe_create_index(op, conn, 'ix_beacon_positions_company_id', 'beacon_positions', ['company_id'])
    ah.safe_create_index(op, conn, 'ix_beacon_positions_zone_id', 'beacon_positions', ['zone_id'])
    ah.safe_create_index(op, conn, 'ix_beacon_positions_company_zone', 'beacon_positions', ['company_id', 'zone_id'])
    ah.safe_add_column(op, conn, 'zones', sa.Column('polygon', JSONB, nullable=True, comment='Normalised floor plan polygon [{x, y}, ...]. Null = not spatially mapped.'))

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_column(op, conn, 'zones', 'polygon')
    ah.safe_drop_index(op, conn, 'ix_beacon_positions_company_zone', 'beacon_positions')
    ah.safe_drop_index(op, conn, 'ix_beacon_positions_zone_id', 'beacon_positions')
    ah.safe_drop_index(op, conn, 'ix_beacon_positions_company_id', 'beacon_positions')
    ah.safe_drop_table(op, conn, 'beacon_positions')
