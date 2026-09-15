"""Codes & Guidance: stable seed slug + user-modified flag.

Lets Vernon starter seed upsert untouched catalog cards by source_key without
clobbering cards Josh has edited. Existing RLS on ops_regulations still applies
(column add only; no new tables).
"""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op
from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1054_reg_source_key"
down_revision = "1053_reg_ref_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(
        op,
        conn,
        "ops_regulations",
        sa.Column("source_key", sa.String(128), nullable=True),
    )
    ah.safe_add_column(
        op,
        conn,
        "ops_regulations",
        sa.Column(
            "user_modified",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    # Backfill slug from seed-key:* tags written by vernon_starter_seed.
    conn.execute(
        text(
            """
            WITH extracted AS (
              SELECT r.id,
                     r.company_id,
                     r.created_at,
                     substr(t, 10) AS source_key
              FROM ops_regulations r
              CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.tags, '[]'::jsonb)) AS t
              WHERE t LIKE 'seed-key:%'
                AND length(t) > 9
            ), ranked AS (
              SELECT id,
                     source_key,
                     row_number() OVER (
                       PARTITION BY company_id, source_key
                       ORDER BY created_at, id
                     ) AS rn
              FROM extracted
            )
            UPDATE ops_regulations r
            SET source_key = ranked.source_key
            FROM ranked
            WHERE r.id = ranked.id
              AND ranked.rn = 1
              AND r.source_key IS NULL
            """
        )
    )
    ah.safe_create_index(
        op,
        conn,
        "uq_ops_reg_company_source_key",
        "ops_regulations",
        ["company_id", "source_key"],
        unique=True,
        postgresql_where=sa.text("source_key IS NOT NULL"),
    )


def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, "uq_ops_reg_company_source_key", "ops_regulations")
    ah.safe_drop_column(op, conn, "ops_regulations", "user_modified")
    ah.safe_drop_column(op, conn, "ops_regulations", "source_key")
