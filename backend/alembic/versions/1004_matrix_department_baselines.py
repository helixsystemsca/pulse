"""Expand permission matrix with department baseline slots; backfill HR matrix_slot."""

from __future__ import annotations

import json

import sqlalchemy as sa
from alembic import op

revision = "1004_matrix_department_baselines"
down_revision = "1003_pulse_worker_hr_matrix_slot"
branch_labels = None
depends_on = None


def upgrade() -> None:
    #: Lazy import — Alembic loads every revision module at startup; avoid app import cycles.
    from app.core.department_matrix_baselines import LEGACY_TEAM_MEMBER_SLOT
    from app.core.permission_feature_matrix import expand_department_role_matrix_baselines, infer_matrix_slot_legacy

    conn = op.get_bind()

    settings_rows = conn.execute(
        sa.text("SELECT id, settings FROM pulse_workers_settings WHERE settings IS NOT NULL")
    ).fetchall()
    for row_id, settings in settings_rows:
        if not isinstance(settings, dict):
            continue
        matrix = settings.get("department_role_feature_access")
        if not isinstance(matrix, dict):
            continue
        expanded = expand_department_role_matrix_baselines(matrix)
        settings["department_role_feature_access"] = expanded
        conn.execute(
            sa.text("UPDATE pulse_workers_settings SET settings = :s::jsonb WHERE id = :id"),
            {"s": json.dumps(settings), "id": row_id},
        )

    hr_rows = conn.execute(
        sa.text(
            """
            SELECT h.user_id, h.department, h.matrix_slot, u.roles, h.job_title
            FROM pulse_worker_hr h
            JOIN users u ON u.id = h.user_id
            """
        )
    ).fetchall()

    for user_id, department, matrix_slot, roles, job_title in hr_rows:
        if matrix_slot and str(matrix_slot).strip():
            continue
        dept = "maintenance"
        if department:
            dept = str(department).strip().lower() or dept
        slot, _src = infer_matrix_slot_legacy(
            roles=list(roles or []),
            job_title=job_title,
            department=dept,
        )
        if slot and slot != LEGACY_TEAM_MEMBER_SLOT:
            conn.execute(
                sa.text("UPDATE pulse_worker_hr SET matrix_slot = :slot WHERE user_id = :uid"),
                {"slot": slot, "uid": user_id},
            )


def downgrade() -> None:
    pass
