"""Per-threshold alert severity (warning vs critical) for monitoring."""
from __future__ import annotations
import sqlalchemy as sa
from alembic import op

from pathlib import Path
import sys

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

revision = '0034'
down_revision = '0033'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'monitoring_sensor_thresholds', sa.Column('alert_severity', sa.String(length=32), nullable=False, server_default='warning'))

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_column(op, conn, 'monitoring_sensor_thresholds', 'alert_severity')
