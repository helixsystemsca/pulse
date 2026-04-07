"""Users: multi-role `roles` varchar[] replaces single `role`."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0043"
down_revision = "0042"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("roles", postgresql.ARRAY(sa.String(length=32)), nullable=True),
    )
    op.execute(sa.text("UPDATE users SET roles = ARRAY[role]::varchar(32)[]"))
    op.alter_column("users", "roles", nullable=False)
    op.drop_column("users", "role")


def downgrade() -> None:
    op.add_column("users", sa.Column("role", sa.String(length=32), nullable=True))
    op.execute(sa.text("UPDATE users SET role = roles[1] WHERE cardinality(roles) >= 1"))
    op.execute(sa.text("UPDATE users SET role = 'worker' WHERE role IS NULL"))
    op.alter_column("users", "role", nullable=False)
    op.drop_column("users", "roles")
