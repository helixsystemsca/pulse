"""Per-user RBAC permission bypass keys (additive grants beyond matrix bridge)."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "1006_user_rbac_permission_extra"
down_revision = "1005_tenant_role_assignments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "rbac_permission_extra",
            JSONB,
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "rbac_permission_extra")
