"""Per-user modal onboarding completion (non-admin tour), distinct from org admin checklist."""

from alembic import op
import sqlalchemy as sa

revision = "0054"
down_revision = "0053"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "user_onboarding_tour_completed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.execute(
        sa.text(
            """
            UPDATE users
            SET user_onboarding_tour_completed = true
            WHERE company_id IS NOT NULL
              AND onboarding_seen IS true
              AND COALESCE(is_system_admin, false) IS false
            """
        )
    )


def downgrade() -> None:
    op.drop_column("users", "user_onboarding_tour_completed")
