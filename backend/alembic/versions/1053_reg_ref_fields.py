"""Add Codes & Guidance fields to ops_regulations (regulatory reference library).

Existing recreation-ops regulations table; no new tenant tables. RLS already
covers ops_regulations (1051).
"""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1053_reg_ref_fields"
down_revision = "1052_vernon_ops_pack"
branch_labels = None
depends_on = None

_EMPTY = sa.text("'[]'::jsonb")


def upgrade() -> None:
    conn = op.get_bind()
    cols = [
        sa.Column("topic_category", sa.String(64), nullable=False, server_default="Other"),
        sa.Column("applicability", sa.Text(), nullable=True),
        sa.Column(
            "classification",
            sa.String(64),
            nullable=False,
            server_default="Regulator guidance",
        ),
        sa.Column("official_source_name", sa.String(255), nullable=True),
        sa.Column("official_source_url", sa.String(1024), nullable=True),
        sa.Column(
            "verification_status",
            sa.String(64),
            nullable=False,
            server_default="Unverified",
        ),
        sa.Column("review_date", sa.Date(), nullable=True),
        sa.Column("pulse_pointers", JSONB(), nullable=False, server_default=_EMPTY),
    ]
    for col in cols:
        ah.safe_add_column(op, conn, "ops_regulations", col)
    ah.safe_create_index(
        op, conn, "ix_ops_regulations_topic_category", "ops_regulations", ["company_id", "topic_category"]
    )


def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, "ix_ops_regulations_topic_category", "ops_regulations")
    for name in (
        "pulse_pointers",
        "review_date",
        "verification_status",
        "official_source_url",
        "official_source_name",
        "classification",
        "applicability",
        "topic_category",
    ):
        ah.safe_drop_column(op, conn, "ops_regulations", name)
