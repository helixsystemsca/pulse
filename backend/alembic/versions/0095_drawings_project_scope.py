"""Scope infra graph and blueprints to pulse_projects.

Revision ID: 0095_drawings_project_scope
Revises: 0094_infra_attr_key_uq
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0095_drawings_project_scope"
down_revision = "0094_infra_attr_key_uq"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "infra_assets",
        sa.Column("project_id", UUID(as_uuid=False), sa.ForeignKey("pulse_projects.id", ondelete="CASCADE"), nullable=True),
    )
    op.create_index("ix_infra_assets_company_project", "infra_assets", ["company_id", "project_id"])

    op.add_column(
        "infra_connections",
        sa.Column("project_id", UUID(as_uuid=False), sa.ForeignKey("pulse_projects.id", ondelete="CASCADE"), nullable=True),
    )
    op.create_index("ix_infra_conn_company_project", "infra_connections", ["company_id", "project_id"])

    op.add_column(
        "blueprints",
        sa.Column("project_id", UUID(as_uuid=False), sa.ForeignKey("pulse_projects.id", ondelete="CASCADE"), nullable=True),
    )
    op.create_index("ix_blueprints_company_project", "blueprints", ["company_id", "project_id"])


def downgrade() -> None:
    op.drop_index("ix_blueprints_company_project", table_name="blueprints")
    op.drop_column("blueprints", "project_id")

    op.drop_index("ix_infra_conn_company_project", table_name="infra_connections")
    op.drop_column("infra_connections", "project_id")

    op.drop_index("ix_infra_assets_company_project", table_name="infra_assets")
    op.drop_column("infra_assets", "project_id")
