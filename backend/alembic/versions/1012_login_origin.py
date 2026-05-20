"""Login event session origin and method for staff vs end-user sign-ins."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1012_login_origin"
down_revision = "1011_staffing_draft"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(
        op,
        conn,
        "login_events",
        sa.Column("login_method", sa.String(32), nullable=False, server_default="password"),
    )
    ah.safe_add_column(
        op,
        conn,
        "login_events",
        sa.Column("session_origin", sa.String(32), nullable=False, server_default="user"),
    )
    ah.safe_add_column(
        op,
        conn,
        "login_events",
        sa.Column(
            "impersonator_user_id",
            UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    ah.safe_create_index(op, conn, "ix_login_events_session_origin", "login_events", ["session_origin"])


def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, "ix_login_events_session_origin", "login_events")
    ah.safe_drop_column(op, conn, "login_events", "impersonator_user_id")
    ah.safe_drop_column(op, conn, "login_events", "session_origin")
    ah.safe_drop_column(op, conn, "login_events", "login_method")
