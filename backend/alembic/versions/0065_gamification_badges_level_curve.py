"""Gamification: XP reason text, streak date, avatar borders, badges."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0065_gamification_badges_level_curve"
down_revision = "0064_xp_ledger_role_tracks"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("xp_ledger", sa.Column("reason", sa.Text(), nullable=True))

    op.add_column("user_stats", sa.Column("last_streak_activity_date", sa.Date(), nullable=True))
    op.add_column("user_stats", sa.Column("avatar_border", sa.String(length=32), nullable=True))
    op.add_column(
        "user_stats",
        sa.Column("unlocked_avatar_borders", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
    )

    op.create_table(
        "badge_definitions",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("icon_key", sa.String(length=64), nullable=False, server_default="badge"),
        sa.Column("category", sa.String(length=64), nullable=False),
    )

    op.create_table(
        "user_badges",
        sa.Column("user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column(
            "badge_id",
            sa.String(length=64),
            sa.ForeignKey("badge_definitions.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("unlocked_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_user_badges_user_id", "user_badges", ["user_id"])

    badges = [
        ("streak_3", "Consistent", "Maintain a 3-day activity streak.", "flame", "attendance"),
        ("streak_7", "Reliable", "Maintain a 7-day activity streak.", "flame", "attendance"),
        ("streak_30", "Unstoppable", "Maintain a 30-day activity streak.", "flame", "attendance"),
        ("wo_10", "Getting Started", "Complete 10 work-order tasks.", "wrench", "work_orders"),
        ("wo_50", "Workhorse", "Complete 50 work-order tasks.", "wrench", "work_orders"),
        ("wo_200", "Machine", "Complete 200 work-order tasks.", "wrench", "work_orders"),
        ("ontime_10", "Punctual", "Complete 10 tasks on time.", "clock", "on_time"),
        ("ontime_50", "Dependable", "Complete 50 tasks on time.", "clock", "on_time"),
        ("proc_10", "Procedure Student", "Complete 10 procedure-style tasks.", "list-checks", "procedures"),
        ("proc_50", "Procedure Pro", "Complete 50 procedure-style tasks.", "list-checks", "procedures"),
        ("insp_10", "Sharp Eye", "Earn 10 inspection-related XP events.", "clipboard-check", "inspections"),
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
    op.drop_index("ix_user_badges_user_id", table_name="user_badges")
    op.drop_table("user_badges")
    op.drop_table("badge_definitions")
    op.drop_column("user_stats", "unlocked_avatar_borders")
    op.drop_column("user_stats", "avatar_border")
    op.drop_column("user_stats", "last_streak_activity_date")
    op.drop_column("xp_ledger", "reason")
