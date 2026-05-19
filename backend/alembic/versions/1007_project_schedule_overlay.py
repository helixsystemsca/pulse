"""Project schedule overlay metadata (colors, staffing, blackout windows)."""

from alembic import op
import sqlalchemy as sa

revision = "1007_project_schedule_overlay"
down_revision = "1006_user_rbac_permission_extra"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "pulse_projects",
        sa.Column("show_on_schedule", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.add_column(
        "pulse_projects",
        sa.Column("overlay_color", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "pulse_projects",
        sa.Column(
            "operational_impact_level",
            sa.String(length=16),
            nullable=False,
            server_default="medium",
        ),
    )
    op.add_column(
        "pulse_projects",
        sa.Column(
            "staffing_priority",
            sa.String(length=16),
            nullable=False,
            server_default="normal",
        ),
    )
    op.add_column(
        "pulse_projects",
        sa.Column("blackout_windows", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("pulse_projects", "blackout_windows")
    op.drop_column("pulse_projects", "staffing_priority")
    op.drop_column("pulse_projects", "operational_impact_level")
    op.drop_column("pulse_projects", "overlay_color")
    op.drop_column("pulse_projects", "show_on_schedule")
