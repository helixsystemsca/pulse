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
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0068_beacon_positions"
down_revision = "0067_proc_rev_kind"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. beacon_positions ───────────────────────────────────────────────────
    # PK is beacon_id — one row per beacon, always reflecting current position.
    # Upserted via ON CONFLICT DO UPDATE in the telemetry ingest endpoint.
    op.create_table(
        "beacon_positions",
        sa.Column(
            "beacon_id",
            UUID(as_uuid=False),
            sa.ForeignKey("automation_ble_devices.id", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
            comment="FK → automation_ble_devices. CASCADE so cleanup is automatic.",
        ),
        sa.Column(
            "company_id",
            UUID(as_uuid=False),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
            comment="Denormalised for fast company-scoped queries on the live map.",
        ),
        sa.Column(
            "x_norm",
            sa.Float(),
            nullable=True,
            comment="Normalised 0.0–1.0 position on floor plan width. Null = position unknown.",
        ),
        sa.Column(
            "y_norm",
            sa.Float(),
            nullable=True,
            comment="Normalised 0.0–1.0 position on floor plan height.",
        ),
        sa.Column(
            "zone_id",
            UUID(as_uuid=False),
            sa.ForeignKey("zones.id", ondelete="SET NULL"),
            nullable=True,
            comment="Zone resolved by polygon lookup. SET NULL if zone is deleted.",
        ),
        sa.Column(
            "position_confidence",
            sa.Float(),
            nullable=True,
            comment="Trilateration quality 0.0–1.0. Low = few gateways heard this beacon.",
        ),
        sa.Column(
            "computed_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
            comment="When the RPI5 position engine last wrote this row.",
        ),
    )

    # company_id index — drives live-map query "give me all beacons for company X"
    op.create_index(
        "ix_beacon_positions_company_id",
        "beacon_positions",
        ["company_id"],
    )

    # zone_id index — drives "all beacons in zone X" for zone-level dashboards
    op.create_index(
        "ix_beacon_positions_zone_id",
        "beacon_positions",
        ["zone_id"],
    )

    # compound index — fast "all worker beacons for company X in zone Y"
    # (used by the proximity engine to find workers near equipment)
    op.create_index(
        "ix_beacon_positions_company_zone",
        "beacon_positions",
        ["company_id", "zone_id"],
    )

    # ── 2. zones.polygon ──────────────────────────────────────────────────────
    # Stores the zone boundary as a JSON array of normalised {x, y} points.
    # Example: [{"x": 0.05, "y": 0.05}, {"x": 0.35, "y": 0.05}, ...]
    # Null means the zone hasn't been spatially mapped yet — zone-level tracking
    # still works via gateway.zone_id assignment; polygon enables exact x,y lookup.
    op.add_column(
        "zones",
        sa.Column(
            "polygon",
            JSONB,
            nullable=True,
            comment="Normalised floor plan polygon [{x, y}, ...]. Null = not spatially mapped.",
        ),
    )


def downgrade() -> None:
    op.drop_column("zones", "polygon")
    op.drop_index("ix_beacon_positions_company_zone", table_name="beacon_positions")
    op.drop_index("ix_beacon_positions_zone_id", table_name="beacon_positions")
    op.drop_index("ix_beacon_positions_company_id", table_name="beacon_positions")
    op.drop_table("beacon_positions")
