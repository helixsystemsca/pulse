"""Project creator (for complete action permission).

Revision ID: 0048
Revises: 0047
Create Date: 2026-04-07

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0048"
down_revision = "0047"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("pulse_projects", sa.Column("created_by_user_id", postgresql.UUID(as_uuid=False), nullable=True))
    op.create_foreign_key(
        "fk_pulse_projects_created_by_user_id_users",
        "pulse_projects",
        "users",
        ["created_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_pulse_projects_created_by_user_id", "pulse_projects", ["created_by_user_id"])
    # Best-effort backfill: treat existing owner as creator when creator is unknown.
    op.execute(
        sa.text(
            "UPDATE pulse_projects SET created_by_user_id = owner_user_id "
            "WHERE created_by_user_id IS NULL AND owner_user_id IS NOT NULL"
        )
    )


def downgrade() -> None:
    op.drop_index("ix_pulse_projects_created_by_user_id", table_name="pulse_projects")
    op.drop_constraint("fk_pulse_projects_created_by_user_id_users", "pulse_projects", type_="foreignkey")
    op.drop_column("pulse_projects", "created_by_user_id")
