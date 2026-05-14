"""Users: multi-role `roles` varchar[] replaces single `role`."""
from __future__ import annotations
import sqlalchemy as sa
from alembic import op

from pathlib import Path
import sys

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

from sqlalchemy.dialects import postgresql
revision = '0043'
down_revision = '0042'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'users', sa.Column('roles', postgresql.ARRAY(sa.String(length=32)), nullable=True))
    op.execute(sa.text('UPDATE users SET roles = ARRAY[role]::varchar(32)[]'))
    ah.safe_alter_column(op, conn, 'users', 'roles', nullable=False)
    ah.safe_drop_column(op, conn, 'users', 'role')

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'users', sa.Column('role', sa.String(length=32), nullable=True))
    op.execute(sa.text('UPDATE users SET role = roles[1] WHERE cardinality(roles) >= 1'))
    op.execute(sa.text("UPDATE users SET role = 'worker' WHERE role IS NULL"))
    ah.safe_alter_column(op, conn, 'users', 'role', nullable=False)
    ah.safe_drop_column(op, conn, 'users', 'roles')
