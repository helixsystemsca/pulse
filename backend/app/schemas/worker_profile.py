"""Unified Worker Profile payload (admin + insights consumers)."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.gamification import BadgeOut, XpLedgerRowOut


class WorkerProfileOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    user_id: str = Field(alias="userId")
    full_name: str = Field(alias="fullName")
    email: str
    role: str
    roles: list[str] = Field(default_factory=list)
    avatar_url: Optional[str] = Field(None, alias="avatarUrl")

    total_xp: int = Field(0, alias="totalXp")
    level: int = 1
    xp_into_level: int = Field(0, alias="xpIntoLevel")
    xp_to_next_level: int = Field(0, alias="xpToNextLevel")

    streak: int = 0
    best_streak: int = Field(0, alias="bestStreak")
    last_streak_activity_date: Optional[str] = Field(None, alias="lastStreakActivityDate")

    avatar_border: Optional[str] = Field(None, alias="avatarBorder")
    unlocked_avatar_borders: list[str] = Field(default_factory=list, alias="unlockedAvatarBorders")

    badges: list[BadgeOut] = Field(default_factory=list)
    recent_xp: list[XpLedgerRowOut] = Field(default_factory=list, alias="recentXp")
    generated_at: datetime = Field(alias="generatedAt")

