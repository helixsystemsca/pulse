"""Schedule Phase 2: availability submissions + acknowledgements + availability format standardization

Revision ID: 0078_sched_p2
Revises: 0077_sched_p1
Create Date: 2026-04-26
"""

from __future__ import annotations

import json
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0078_sched_p2"
down_revision = "0077_sched_p1"
branch_labels = None
depends_on = None


_WDAY = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


def _windows_v1_to_v2(av: dict) -> dict:
    """
    Convert legacy availability format:
      {"windows":[{"weekday":0,"start_min":480,"end_min":1020}, ...]}
    into v2:
      {"monday":[{"start":480,"end":1020}], ...}
    """
    out: dict[str, list[dict]] = {k: [] for k in _WDAY}
    wins = av.get("windows") if isinstance(av, dict) else None
    if not isinstance(wins, list):
        return av
    for w in wins:
        if not isinstance(w, dict):
            continue
        try:
            wd = int(w.get("weekday", -1))
            sm = int(w.get("start_min", -1))
            em = int(w.get("end_min", -1))
        except (TypeError, ValueError):
            continue
        if wd < 0 or wd > 6:
            continue
        if sm < 0 or sm >= 1440 or em < 0 or em >= 1440:
            continue
        out[_WDAY[wd]].append({"start": sm, "end": em})
    return out


def upgrade() -> None:
    # Availability submissions: per worker per period.
    op.create_table(
        "pulse_schedule_availability_submissions",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), nullable=False),
        sa.Column("worker_id", UUID(as_uuid=False), nullable=False),
        sa.Column("period_id", UUID(as_uuid=False), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("windows", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("exceptions", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["worker_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["period_id"], ["pulse_schedule_periods.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("worker_id", "period_id", name="uq_sched_avail_worker_period"),
    )
    op.create_index(
        "ix_sched_avail_company_period",
        "pulse_schedule_availability_submissions",
        ["company_id", "period_id"],
    )
    op.create_index(
        "ix_sched_avail_worker_id",
        "pulse_schedule_availability_submissions",
        ["worker_id"],
    )

    # Acknowledgements: worker acknowledged published schedule for a period.
    op.create_table(
        "pulse_schedule_acknowledgements",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), nullable=False),
        sa.Column("worker_id", UUID(as_uuid=False), nullable=False),
        sa.Column("period_id", UUID(as_uuid=False), nullable=False),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["worker_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["period_id"], ["pulse_schedule_periods.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("worker_id", "period_id", name="uq_sched_ack_worker_period"),
    )
    op.create_index(
        "ix_sched_ack_company_period",
        "pulse_schedule_acknowledgements",
        ["company_id", "period_id"],
    )

    # Worker availability: standardize stored format in pulse_worker_profiles.availability to v2 where possible.
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, availability FROM pulse_worker_profiles")).fetchall()
    for rid, availability in rows:
        if not availability or not isinstance(availability, (dict,)):
            continue
        if "windows" not in availability:
            continue
        new_av = _windows_v1_to_v2(dict(availability))
        conn.execute(
            sa.text("UPDATE pulse_worker_profiles SET availability = :av WHERE id = :id"),
            {"id": str(rid), "av": json.dumps(new_av)},
        )


def downgrade() -> None:
    op.drop_index("ix_sched_ack_company_period", table_name="pulse_schedule_acknowledgements")
    op.drop_table("pulse_schedule_acknowledgements")

    op.drop_index("ix_sched_avail_worker_id", table_name="pulse_schedule_availability_submissions")
    op.drop_index("ix_sched_avail_company_period", table_name="pulse_schedule_availability_submissions")
    op.drop_table("pulse_schedule_availability_submissions")

