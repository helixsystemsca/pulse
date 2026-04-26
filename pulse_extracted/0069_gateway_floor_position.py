"""Add x_norm and y_norm position columns to automation_gateways.

Revision ID: 0069_gateway_floor_position
Revises: 0068_beacon_positions
Create Date: 2026-04-24

What this adds
--------------
x_norm and y_norm on automation_gateways — the physical position of each
ESP32 Gateway on the floor plan, normalised 0.0–1.0.

Why these are needed
---------------------
The RPI5 position engine needs to know where each Gateway is physically
located to run trilateration. Without these coordinates it can't compute
(x, y) positions for beacons.

How operators set them
-----------------------
Once these columns exist, add a position picker to the Devices tab
(drag Gateway dot onto floor plan, saves x_norm/y_norm via PATCH /api/v1/gateways/:id).
Until then, operators can set them directly in Supabase or via the fallback
dict in position_engine_mesh.py.

The position engine bootstraps these on startup via GET /api/v1/gateways —
any gateway with non-null x_norm/y_norm is used for trilateration.
Gateways without positions are still used for zone-level assignment.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision      = "0069_gateway_floor_position"
down_revision = "0068_beacon_positions"
branch_labels = None
depends_on    = None


def upgrade() -> None:
    # x_norm: normalised 0.0–1.0 position on floor plan width axis
    op.add_column(
        "automation_gateways",
        sa.Column(
            "x_norm",
            sa.Float(),
            nullable=True,
            comment="Normalised 0.0–1.0 floor plan x position. Set via Devices tab.",
        ),
    )
    # y_norm: normalised 0.0–1.0 position on floor plan height axis
    op.add_column(
        "automation_gateways",
        sa.Column(
            "y_norm",
            sa.Float(),
            nullable=True,
            comment="Normalised 0.0–1.0 floor plan y position. Set via Devices tab.",
        ),
    )


def downgrade() -> None:
    op.drop_column("automation_gateways", "y_norm")
    op.drop_column("automation_gateways", "x_norm")
