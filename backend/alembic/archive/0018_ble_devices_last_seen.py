"""Add last_seen_at to registered BLE devices for activity UI."""

from __future__ import annotations

from pathlib import Path
import sys

import sqlalchemy as sa
from alembic import op

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(
        op,
        conn,
        "automation_ble_devices",
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_column(op, conn, "automation_ble_devices", "last_seen_at")
