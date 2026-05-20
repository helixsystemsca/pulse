"""Remove legacy bootstrap system admin jc@helixpulse.com if present."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0025"
down_revision = "0024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text("DELETE FROM users WHERE LOWER(email) = LOWER(:email)"),
        {"email": "jc@helixpulse.com"},
    )


def downgrade() -> None:
    pass
