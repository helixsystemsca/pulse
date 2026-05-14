"""pulse_project_summaries: persisted project summary JSON snapshots."""
from __future__ import annotations
import sqlalchemy as sa
from alembic import op

from pathlib import Path
import sys

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

from sqlalchemy.dialects.postgresql import JSONB, UUID
revision = '0101_pulse_project_summaries'
down_revision = '0100_procedure_search_keywords'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_create_table(op, conn, 'pulse_project_summaries', sa.Column('id', UUID(as_uuid=False), nullable=False), sa.Column('project_id', UUID(as_uuid=False), nullable=False), sa.Column('snapshot_json', JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False), sa.Column('metrics_json', JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False), sa.Column('user_inputs_json', JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False), sa.Column('status', sa.String(length=16), server_default=sa.text("'draft'"), nullable=False), sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False), sa.Column('finalized_at', sa.DateTime(timezone=True), nullable=True), sa.ForeignKeyConstraint(['project_id'], ['pulse_projects.id'], ondelete='CASCADE'), sa.PrimaryKeyConstraint('id'))
    ah.safe_create_index(op, conn, 'ix_pulse_project_summaries_project_id', 'pulse_project_summaries', ['project_id'], unique=False)

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_pulse_project_summaries_project_id', 'pulse_project_summaries')
    ah.safe_drop_table(op, conn, 'pulse_project_summaries')
