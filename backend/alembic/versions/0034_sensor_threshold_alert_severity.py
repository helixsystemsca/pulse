"""Per-threshold alert severity (warning vs critical) for monitoring."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0034"
down_revision = "0033"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "monitoring_sensor_thresholds",
        sa.Column("alert_severity", sa.String(length=32), nullable=False, server_default="warning"),
    )


def downgrade() -> None:
    op.drop_column("monitoring_sensor_thresholds", "alert_severity")
