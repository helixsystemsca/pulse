"""Alpha baseline — full schema from current SQLAlchemy metadata.

Revision ID: 1000_alpha_baseline
Revises:
Create Date: 2026-05-15

Historical revisions (0001–0128) live in ``alembic/archive/`` for reference only.
New migrations must use ``down_revision = "1000_alpha_baseline"`` (or the current head)
and keep ``revision`` identifiers concise (≤32 chars recommended; see ``alembic/REVISION_NAMING.md``).
``alembic_version.version_num`` is widened to VARCHAR(128) before upgrades run.
"""

from alembic import op

import app.models  # noqa: F401 — register all ORM mappers
import app.models.rbac_models  # noqa: F401 — RBAC tables on metadata before create_all
from app.models.base import Base

revision = "1000_alpha_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
