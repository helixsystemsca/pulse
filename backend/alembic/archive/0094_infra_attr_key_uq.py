"""Single attribute row per (entity_type, entity_id, key) on infra_attributes.

Revision ID: 0094_infra_attr_key_uq
Revises: 0093_merge_infra_graph_head
Create Date: 2026-05-01
"""
from __future__ import annotations
from alembic import op

from pathlib import Path
import sys

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

revision = '0094_infra_attr_key_uq'
down_revision = '0093_merge_infra_graph_head'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    op.execute('\n        DELETE FROM infra_attributes\n        WHERE id IN (\n            SELECT id FROM (\n                SELECT id,\n                       ROW_NUMBER() OVER (\n                           PARTITION BY entity_type, entity_id, key\n                           ORDER BY created_at DESC\n                       ) AS rn\n                FROM infra_attributes\n            ) sub\n            WHERE sub.rn > 1\n        )\n        ')
    ah.safe_create_unique_constraint(op, conn, 'uq_infra_attributes_entity_key', 'infra_attributes', ['entity_type', 'entity_id', 'key'])

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_constraint(op, conn, 'uq_infra_attributes_entity_key', 'infra_attributes', type_='unique')
