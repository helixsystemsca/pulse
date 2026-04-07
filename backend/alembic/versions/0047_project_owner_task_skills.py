"""Project owner + task required skills (workforce matching).

Revision ID: 0047
Revises: 0046
Create Date: 2026-04-07

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0047"
down_revision = "0046"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("pulse_projects", sa.Column("owner_user_id", postgresql.UUID(as_uuid=False), nullable=True))
    op.create_foreign_key(
        "fk_pulse_projects_owner_user_id_users",
        "pulse_projects",
        "users",
        ["owner_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_pulse_projects_owner_user_id", "pulse_projects", ["owner_user_id"])

    op.add_column(
        "pulse_project_tasks",
        sa.Column(
            "required_skill_names",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column("pulse_project_tasks", "required_skill_names")
    op.drop_index("ix_pulse_projects_owner_user_id", table_name="pulse_projects")
    op.drop_constraint("fk_pulse_projects_owner_user_id_users", "pulse_projects", type_="foreignkey")
    op.drop_column("pulse_projects", "owner_user_id")
