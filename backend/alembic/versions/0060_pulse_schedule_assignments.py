"""pulse_schedule_assignments (night shift areas + notes)

Revision ID: 0060_pulse_schedule_assignments
Revises: 0059_blueprint_layers
Create Date: 2026-04-14
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0060_pulse_schedule_assignments"
down_revision = "0059_blueprint_layers"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pulse_schedule_assignments",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("company_id", sa.String(length=36), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("shift_type", sa.String(length=32), nullable=False, server_default="night"),
        sa.Column("area", sa.String(length=128), nullable=False),
        sa.Column("assigned_user_id", sa.String(length=36), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["assigned_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("company_id", "date", "shift_type", "area", name="uq_pulse_schedule_assign_area"),
    )
    op.create_index("ix_pulse_schedule_assignments_company_id", "pulse_schedule_assignments", ["company_id"])
    op.create_index("ix_pulse_schedule_assignments_date", "pulse_schedule_assignments", ["date"])
    op.create_index("ix_pulse_schedule_assignments_shift_type", "pulse_schedule_assignments", ["shift_type"])
    op.create_index("ix_pulse_schedule_assignments_assigned_user_id", "pulse_schedule_assignments", ["assigned_user_id"])


def downgrade() -> None:
    op.drop_index("ix_pulse_schedule_assignments_assigned_user_id", table_name="pulse_schedule_assignments")
    op.drop_index("ix_pulse_schedule_assignments_shift_type", table_name="pulse_schedule_assignments")
    op.drop_index("ix_pulse_schedule_assignments_date", table_name="pulse_schedule_assignments")
    op.drop_index("ix_pulse_schedule_assignments_company_id", table_name="pulse_schedule_assignments")
    op.drop_table("pulse_schedule_assignments")

