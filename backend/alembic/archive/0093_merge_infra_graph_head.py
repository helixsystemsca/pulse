"""Merge heads: infra graph tables + mainline

Revision ID: 0093_merge_infra_graph_head
Revises: 0092_notif_engine, 0076_infra_graph_tables
Create Date: 2026-05-01
"""

from __future__ import annotations

from alembic import op

revision = "0093_merge_infra_graph_head"
down_revision = ("0092_notif_engine", "0076_infra_graph_tables")
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Merge revision: no schema changes, just resolves multiple heads.
    pass


def downgrade() -> None:
    # Downgrading from a merge just returns to the two branches.
    pass

