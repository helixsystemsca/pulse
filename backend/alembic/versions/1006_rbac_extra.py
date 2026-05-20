"""Per-user RBAC permission bypass keys (additive grants beyond matrix bridge)."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1006_rbac_extra"
down_revision = "1005_role_assignments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(
        op,
        conn,
        "users",
        sa.Column(
            "rbac_permission_extra",
            JSONB,
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )


def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_column(op, conn, "users", "rbac_permission_extra")
