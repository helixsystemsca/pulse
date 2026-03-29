"""Add entity_id to domain_events for first-class event model.

Revision ID: 0003
Revises: 0002
Create Date: 2026-03-26

"""

from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("domain_events", sa.Column("entity_id", sa.String(length=64), nullable=True))
    op.create_index("ix_domain_events_entity_id", "domain_events", ["entity_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_domain_events_entity_id", table_name="domain_events")
    op.drop_column("domain_events", "entity_id")
