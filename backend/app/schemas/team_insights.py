"""Team Insights: motivating workforce gamification + light performance summary."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.gamification import BadgeOut


class TeamInsightsWorkerOut(BaseModel):
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
    last_streak_activity_date: Optional[str] = Field(None, alias="lastStreakActivityDate")
    avatar_border: Optional[str] = Field(None, alias="avatarBorder")

    badges: list[BadgeOut] = Field(default_factory=list, description="Top earned badges (most recent first).")


class TeamInsightsActivityOut(BaseModel):
    created_at: datetime = Field(alias="createdAt")
    user_id: str = Field(alias="userId")
    user_name: str = Field(alias="userName")
    kind: str
    message: str
    xp_delta: int = Field(0, alias="xpDelta")


class TeamInsightsSummaryOut(BaseModel):
    total_team_xp: int = Field(0, alias="totalTeamXp")
    active_streaks: int = Field(0, alias="activeStreaks")
    top_performer_user_id: Optional[str] = Field(None, alias="topPerformerUserId")
    top_performer_name: Optional[str] = Field(None, alias="topPerformerName")
    top_performer_week_xp: int = Field(0, alias="topPerformerWeekXp")
    most_improved_user_id: Optional[str] = Field(None, alias="mostImprovedUserId")
    most_improved_name: Optional[str] = Field(None, alias="mostImprovedName")
    most_improved_delta: int = Field(0, alias="mostImprovedDelta")


class TeamInsightsOut(BaseModel):
    summary: TeamInsightsSummaryOut
    workers: list[TeamInsightsWorkerOut]
    recent_activity: list[TeamInsightsActivityOut] = Field(default_factory=list, alias="recentActivity")

