"""Add entity_id to domain_events for first-class event model.

Revision ID: 0003
Revises: 0002
Create Date: 2026-03-26

"""

from pathlib import Path
import sys

from alembic import op
import sqlalchemy as sa

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    if ah.column_exists(conn, "domain_events", "entity_id"):
        return
    op.add_column("domain_events", sa.Column("entity_id", sa.String(length=64), nullable=True))
    op.create_index("ix_domain_events_entity_id", "domain_events", ["entity_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_domain_events_entity_id", table_name="domain_events")
    op.drop_column("domain_events", "entity_id")
