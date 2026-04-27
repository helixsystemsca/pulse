"""migrate pulse_preventative_rules to pm_tasks (deprecate legacy PM rules)

Revision ID: 0074_migrate_prev_to_pm
Revises: 0073_no_shift_overlap
Create Date: 2026-04-26
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision = "0074_migrate_prev_to_pm"
down_revision = "0073_no_shift_overlap"
branch_labels = None
depends_on = None


_FREQ_RE = re.compile(r"^\s*(?P<n>\d+)\s*(?P<u>day|days|week|weeks|month|months)\s*$", re.IGNORECASE)


def _parse_frequency(freq: str) -> tuple[str, int] | None:
    f = (freq or "").strip().lower()
    if not f:
        return None
    if f in ("monthly", "month"):
        return ("months", 1)
    if f in ("weekly", "week"):
        return ("weeks", 1)
    if f in ("daily", "day"):
        return ("days", 1)
    m = _FREQ_RE.match(f)
    if not m:
        return None
    n = int(m.group("n"))
    u = m.group("u").lower()
    if u.startswith("day"):
        return ("days", n)
    if u.startswith("week"):
        return ("weeks", n)
    if u.startswith("month"):
        return ("months", n)
    return None


def upgrade() -> None:
    conn = op.get_bind()

    # If the legacy table isn't present in this environment, nothing to migrate.
    if conn.execute(sa.text("SELECT to_regclass('public.pulse_preventative_rules')")).scalar_one() is None:
        return

    now = datetime.now(timezone.utc)

    rules = conn.execute(
        sa.text(
            """
            SELECT id, company_id, equipment_id, frequency, procedure_id
            FROM pulse_preventative_rules
            ORDER BY updated_at DESC
            """
        )
    ).mappings().all()

    for r in rules:
        parsed = _parse_frequency(str(r["frequency"]))
        if not parsed:
            # Leave the rule in place; a human can migrate this one manually.
            continue
        ft, fv = parsed

        # Idempotency: if we've already created a migrated PM task for this rule, skip.
        exists = conn.execute(
            sa.text(
                """
                SELECT 1
                FROM pm_tasks
                WHERE equipment_id = :equipment_id
                  AND tool_id IS NULL
                  AND name = :name
                  AND frequency_type = :ft
                  AND frequency_value = :fv
                LIMIT 1
                """
            ),
            {
                "equipment_id": str(r["equipment_id"]),
                "name": "Preventative (migrated)",
                "ft": ft,
                "fv": int(fv),
            },
        ).first()
        if exists:
            continue

        desc = f"Migrated from pulse_preventative_rules {str(r['id'])} (frequency: {str(r['frequency']).strip()})."
        if r["procedure_id"]:
            desc += f" Legacy procedure_id: {str(r['procedure_id'])}."

        pm_id = str(uuid4())
        conn.execute(
            sa.text(
                """
                INSERT INTO pm_tasks (
                    id,
                    equipment_id,
                    tool_id,
                    name,
                    description,
                    frequency_type,
                    frequency_value,
                    last_completed_at,
                    next_due_at,
                    estimated_duration_minutes,
                    auto_create_work_order,
                    created_at,
                    updated_at
                ) VALUES (
                    :id,
                    :equipment_id,
                    NULL,
                    :name,
                    :description,
                    :frequency_type,
                    :frequency_value,
                    NULL,
                    :next_due_at,
                    NULL,
                    true,
                    :created_at,
                    :updated_at
                )
                """
            ),
            {
                "id": pm_id,
                "equipment_id": str(r["equipment_id"]),
                "name": "Preventative (migrated)",
                "description": desc,
                "frequency_type": ft,
                "frequency_value": int(fv),
                "next_due_at": now,
                "created_at": now,
                "updated_at": now,
            },
        )


def downgrade() -> None:
    # Non-reversible data migration.
    pass

