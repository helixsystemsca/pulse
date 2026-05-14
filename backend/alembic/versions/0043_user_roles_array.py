"""Users: multi-role `roles` varchar[] replaces single `role`."""
from __future__ import annotations

from pathlib import Path
import sys

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

revision = "0043"
down_revision = "0042"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(
        op,
        conn,
        "users",
        sa.Column("roles", postgresql.ARRAY(sa.String(length=32)), nullable=True),
    )

    if ah.column_exists(conn, "users", "role"):
        op.execute(sa.text("UPDATE users SET roles = ARRAY[role]::varchar(32)[]"))
    else:
        ah.skip(
            "backfill_roles_from_role",
            table="users",
            column="role",
            cause="role_column_missing",
        )

    if ah.column_exists(conn, "users", "roles"):
        ah.safe_alter_column(op, conn, "users", "roles", nullable=False)

    ah.safe_drop_column(op, conn, "users", "role")


def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, "users", sa.Column("role", sa.String(length=32), nullable=True))

    if ah.column_exists(conn, "users", "roles"):
        op.execute(sa.text("UPDATE users SET role = roles[1] WHERE cardinality(roles) >= 1"))
        op.execute(sa.text("UPDATE users SET role = 'worker' WHERE role IS NULL"))
    else:
        ah.skip(
            "restore_role_from_roles",
            table="users",
            column="roles",
            cause="roles_column_missing",
        )

    if ah.column_exists(conn, "users", "role"):
        ah.safe_alter_column(op, conn, "users", "role", nullable=False)

    ah.safe_drop_column(op, conn, "users", "roles")
