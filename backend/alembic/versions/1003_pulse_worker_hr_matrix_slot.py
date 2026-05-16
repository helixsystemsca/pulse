"""Add explicit pulse_worker_hr.matrix_slot for deterministic permission matrix resolution."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.core.permission_feature_matrix import infer_matrix_slot_legacy

revision = "1003_pulse_worker_hr_matrix_slot"
down_revision = "1002_inventory_scopes"
branch_labels = None
depends_on = None


def _roles_from_pg_array(raw: object) -> list[str]:
    if raw is None:
        return []
    if isinstance(raw, list):
        return [str(x) for x in raw]
    s = str(raw).strip()
    if s.startswith("{") and s.endswith("}"):
        inner = s[1:-1]
        if not inner:
            return []
        return [p.strip().strip('"') for p in inner.split(",") if p.strip()]
    return [s] if s else []


def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(
        op,
        conn,
        "pulse_worker_hr",
        sa.Column("matrix_slot", sa.String(32), nullable=True),
    )

    rows = conn.execute(
        sa.text(
            """
            SELECT h.user_id, h.job_title, u.roles
            FROM pulse_worker_hr h
            JOIN users u ON u.id = h.user_id
            WHERE h.matrix_slot IS NULL
            """
        )
    ).fetchall()

    for user_id, job_title, roles_raw in rows:
        roles = _roles_from_pg_array(roles_raw)
        slot, src = infer_matrix_slot_legacy(roles=roles, job_title=job_title)
        #: Only persist non-default inference so ``NULL`` keeps legacy fallback (e.g. worker + empty title).
        if src == "fallback_default":
            continue
        conn.execute(
            sa.text("UPDATE pulse_worker_hr SET matrix_slot = :slot WHERE user_id = :uid"),
            {"slot": slot, "uid": str(user_id)},
        )


def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_column(op, conn, "pulse_worker_hr", "matrix_slot")
