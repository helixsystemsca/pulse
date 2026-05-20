"""pulse_schedule_shifts: prevent overlapping shifts per user

Revision ID: 0073_no_shift_overlap
Revises: 0072_pm_tasks_tool_id
Create Date: 2026-04-26
"""

from __future__ import annotations

from alembic import op

revision = "0073_no_shift_overlap"
down_revision = "0072_pm_tasks_tool_id"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Needed for GiST exclusion constraints on UUID equality.
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist;")

    # Prevent double-booking: same company + same assigned_user_id cannot have overlapping time ranges.
    # Use [) so shifts that "touch" at end/start are allowed (e.g. 08:00-12:00 and 12:00-16:00).
    op.execute(
        """
        ALTER TABLE pulse_schedule_shifts
        ADD CONSTRAINT no_user_shift_overlap
        EXCLUDE USING gist (
            company_id WITH =,
            assigned_user_id WITH =,
            tstzrange(starts_at, ends_at, '[)') WITH &&
        );
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE pulse_schedule_shifts DROP CONSTRAINT IF EXISTS no_user_shift_overlap;")
    # Leave btree_gist installed; other constraints may rely on it.

