"""Merge heads: routine assignments branch + project summaries branch.

This is a no-op merge revision to resolve multiple Alembic heads so that
`alembic upgrade head` works in deployment environments (Render).
"""

from __future__ import annotations

from alembic import op

revision = "0103_merge_heads"
down_revision = ("0101_pulse_project_summaries", "0102_routine_assignments_extras")
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("-- alembic merge: no-op")


def downgrade() -> None:
    op.execute("-- alembic merge: no-op")
