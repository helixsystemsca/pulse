"""Single attribute row per (entity_type, entity_id, key) on infra_attributes.

Revision ID: 0094_infra_attr_key_uq
Revises: 0093_merge_infra_graph_head
Create Date: 2026-05-01
"""

from __future__ import annotations

from alembic import op

revision = "0094_infra_attr_key_uq"
down_revision = "0093_merge_infra_graph_head"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop duplicates: keep the newest row per (entity_type, entity_id, key).
    op.execute(
        """
        DELETE FROM infra_attributes
        WHERE id IN (
            SELECT id FROM (
                SELECT id,
                       ROW_NUMBER() OVER (
                           PARTITION BY entity_type, entity_id, key
                           ORDER BY created_at DESC
                       ) AS rn
                FROM infra_attributes
            ) sub
            WHERE sub.rn > 1
        )
        """
    )
    op.create_unique_constraint(
        "uq_infra_attributes_entity_key",
        "infra_attributes",
        ["entity_type", "entity_id", "key"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_infra_attributes_entity_key", "infra_attributes", type_="unique")
