"""Initial schema — creates all tables from SQLAlchemy metadata.

Revision ID: 0001
Revises:
Create Date: 2026-03-26

"""

from alembic import op

import app.models  # noqa: F401 — register ORM mappers
from app.models.base import Base

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    # Guard: create_all is idempotent for missing tables only; use Alembic for prod deltas.
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
