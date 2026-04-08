"""Per-organization unified module settings JSON."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0053"
down_revision = "0052"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pulse_org_module_settings",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("settings", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index(
        "ix_pulse_org_module_settings_company_id",
        "pulse_org_module_settings",
        ["company_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_pulse_org_module_settings_company_id", table_name="pulse_org_module_settings")
    op.drop_table("pulse_org_module_settings")
