"""Add sub_location on work requests for facility-area analytics."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1017_work_request_sub_location"
down_revision = "1016_rbac_core"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(
        op,
        conn,
        "pulse_work_requests",
        sa.Column("sub_location", sa.String(64), nullable=True),
    )
    ah.safe_create_index(
        op,
        conn,
        "ix_pulse_work_requests_sub_location",
        "pulse_work_requests",
        ["sub_location"],
    )


def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, "ix_pulse_work_requests_sub_location", "pulse_work_requests")
    ah.safe_drop_column(op, conn, "pulse_work_requests", "sub_location")
