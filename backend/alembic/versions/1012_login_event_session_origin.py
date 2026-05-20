"""Login event session origin and method for staff vs end-user sign-ins."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "1012_login_event_session_origin"
down_revision = "1011_staffing_requirements_draft_meta"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "login_events",
        sa.Column("login_method", sa.String(32), nullable=False, server_default="password"),
    )
    op.add_column(
        "login_events",
        sa.Column("session_origin", sa.String(32), nullable=False, server_default="user"),
    )
    op.add_column(
        "login_events",
        sa.Column(
            "impersonator_user_id",
            UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_login_events_session_origin", "login_events", ["session_origin"])


def downgrade() -> None:
    op.drop_index("ix_login_events_session_origin", table_name="login_events")
    op.drop_column("login_events", "impersonator_user_id")
    op.drop_column("login_events", "session_origin")
    op.drop_column("login_events", "login_method")
