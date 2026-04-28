"""Gamification G5: additional badge definitions (inference, PM, first task, century streak).

Revision ID: 0080_g5_badges
Revises: 0079_named_streaks
Create Date: 2026-04-27
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text

revision = "0080_g5_badges"
down_revision = "0079_named_streaks"
branch_labels = None
depends_on = None


def upgrade() -> None:
    badges = [
        ("inference_5", "Maintenance Spotter", "Confirmed 5 maintenance inferences", "eye", "initiative"),
        ("inference_20", "Early Detector", "Confirmed 20 maintenance inferences", "alert", "initiative"),
        ("pm_guardian_5", "PM Guardian", "5 PMs completed on time", "shield", "reliability"),
        ("first_task", "First Task", "Complete your first task", "flag", "volume"),
        ("streak_100", "Century Streak", "100-day activity streak", "trophy", "streak"),
    ]
    ins = text(
        "INSERT INTO badge_definitions (id, name, description, icon_key, category) "
        "VALUES (:id, :name, :description, :icon_key, :category) ON CONFLICT (id) DO NOTHING"
    )
    bind = op.get_bind()
    for bid, name, desc, icon, cat in badges:
        bind.execute(
            ins,
            {"id": bid, "name": name, "description": desc, "icon_key": icon, "category": cat},
        )


def downgrade() -> None:
    ids = ("inference_5", "inference_20", "pm_guardian_5", "first_task", "streak_100")
    bind = op.get_bind()
    for bid in ids:
        bind.execute(sa.text("DELETE FROM user_badges WHERE badge_id = :bid"), {"bid": bid})
        bind.execute(sa.text("DELETE FROM badge_definitions WHERE id = :bid"), {"bid": bid})
