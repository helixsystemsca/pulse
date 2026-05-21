"""Sequential work order numbers per tenant (WO#0001)."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1018_work_order_number"
down_revision = "1017_work_request_sub_location"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(
        op,
        conn,
        "pulse_work_requests",
        sa.Column("work_order_number", sa.Integer(), nullable=True),
    )

    # Backfill per company by created_at so existing rows get stable WO#0001…
    op.execute(
        sa.text(
            """
            WITH ranked AS (
              SELECT id,
                     ROW_NUMBER() OVER (
                       PARTITION BY company_id
                       ORDER BY created_at ASC, id ASC
                     ) AS rn
              FROM pulse_work_requests
            )
            UPDATE pulse_work_requests AS wr
            SET work_order_number = ranked.rn
            FROM ranked
            WHERE wr.id = ranked.id
            """
        )
    )

    op.alter_column("pulse_work_requests", "work_order_number", nullable=False)

    ah.safe_create_index(
        op,
        conn,
        "ix_pulse_work_requests_work_order_number",
        "pulse_work_requests",
        ["work_order_number"],
    )
    ah.safe_create_unique_constraint(
        op,
        conn,
        "uq_pulse_work_requests_company_wo_number",
        "pulse_work_requests",
        ["company_id", "work_order_number"],
    )


def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_constraint(
        op, conn, "uq_pulse_work_requests_company_wo_number", "pulse_work_requests", type_="unique"
    )
    ah.safe_drop_index(op, conn, "ix_pulse_work_requests_work_order_number", "pulse_work_requests")
    ah.safe_drop_column(op, conn, "pulse_work_requests", "work_order_number")
