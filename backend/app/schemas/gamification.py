"""Pydantic schemas for gamified tasks + XP."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


TaskStatus = Literal["todo", "in_progress", "done"]
TaskSourceType = Literal["work_order", "pm", "project", "routine", "self"]


class TaskOut(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    assigned_to: Optional[str] = None
    created_by: Optional[str] = None
    source_type: TaskSourceType
    source_id: Optional[str] = None
    equipment_id: Optional[str] = None
    priority: int = 1
    difficulty: int = 1
    status: TaskStatus
    due_date: Optional[datetime] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    xp_awarded: int = 0


class BadgeOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    name: str
    description: str
    icon_key: str = Field(alias="iconKey")
    category: str
    unlocked_at: datetime | None = Field(None, alias="unlockedAt")
    rarity: str | None = Field("common", description="common | uncommon | rare | epic")
    xp_reward: int = Field(0, alias="xpReward")
    is_locked: bool = Field(False, alias="isLocked", description="True when shown in catalog but not earned")


class CompleteTaskResult(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    xp: int
    totalXp: int = Field(alias="totalXp")
    level: int
    xp_into_level: int = Field(0, alias="xpIntoLevel")
    xp_to_next_level: int = Field(0, alias="xpToNextLevel")
    leveled_up: bool = Field(False, alias="leveledUp")
    new_badges: list[BadgeOut] = Field(default_factory=list, alias="newBadges")
    reason: str | None = None
    xp_breakdown: dict[str, int] | None = Field(
        None,
        alias="xpBreakdown",
        description="Approximate base/steps/photo/clean/speed buckets before daily caps",
    )


class UserAnalyticsOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    totalXp: int
    level: int
    xp_into_level: int = Field(0, alias="xpIntoLevel")
    xp_to_next_level: int = Field(0, alias="xpToNextLevel")
    tasksCompleted: int
    onTimeRate: float
    avgCompletionTime: float
    reviewScore: float
    initiativeScore: float
    streak: int = 0
    avatar_border: str | None = Field(None, alias="avatarBorder")
    unlocked_avatar_borders: list[str] = Field(default_factory=list, alias="unlockedAvatarBorders")
    xpWorker: int = Field(0, description="Cumulative worker-track XP")
    xpLead: int = Field(0, description="Cumulative lead-track XP")
    xpSupervisor: int = Field(0, description="Cumulative supervisor-track XP")
    named_streaks: dict[str, Any] = Field(default_factory=dict, alias="namedStreaks")

    professional_level: int = Field(1, alias="professionalLevel")
    professional_title: str = Field("Operator I", alias="professionalTitle")
    professional_xp_into: int = Field(0, alias="professionalXpInto")
    professional_xp_to_next: int = Field(0, alias="professionalXpToNext")
    attendance_shift_streak: int = Field(0, alias="attendanceShiftStreak")
    perfect_weeks: int = Field(0, alias="perfectWeeks")
    procedures_completed: int = Field(0, alias="proceduresCompleted")
    recognitions_received: int = Field(0, alias="recognitionsReceived")
    pm_completed: int = Field(0, alias="pmCompleted")
    work_orders_completed: int = Field(0, alias="workOrdersCompleted")
    routines_completed: int = Field(0, alias="routinesCompleted")
    last_activity_at: datetime | None = Field(None, alias="lastActivityAt")


class XpLedgerRowOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    amount: int
    reason_code: str = Field(alias="reasonCode")
    reason: str | None = None
    track: str
    created_at: datetime = Field(alias="createdAt")
    category: str | None = None
    source_type: str | None = Field(None, alias="sourceType")
    source_id: str | None = Field(None, alias="sourceId")


class GamificationMeOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    analytics: UserAnalyticsOut
    unlocked_badges: list[BadgeOut] = Field(default_factory=list, alias="unlockedBadges")
    badge_catalog: list[BadgeOut] = Field(default_factory=list, alias="badgeCatalog")
    recent_xp: list[XpLedgerRowOut] = Field(default_factory=list, alias="recentXp")


class LeaderboardEntryOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    rank: int
    user_id: str = Field(alias="userId")
    display_name: str = Field(alias="displayName")
    total_xp: int = Field(alias="totalXp")
    level: int
    is_me: bool = Field(alias="isMe")


class CertificationOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    code: str
    label: str
    expires_at: datetime | None = Field(None, alias="expiresAt")
    days_until_expiry: int | None = Field(None, alias="daysUntilExpiry")


class ManagerAwardXpIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    target_user_id: str = Field(min_length=1, alias="targetUserId")
    amount: int = Field(ge=1, le=500)
    reason: str = Field(min_length=1, max_length=500)


class ManagerAwardXpOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    ok: bool = True
    applied: int = 0
    total_xp: int = Field(0, alias="totalXp")
    level: int = 1


class AvatarBorderIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    avatar_border: str | None = Field(None, alias="avatarBorder", description="bronze|silver|gold|elite|null")


class SupervisorOneOnOneIn(BaseModel):
    employee_user_id: str = Field(min_length=1)


class SupervisorOneOnOneOut(BaseModel):
    ok: bool = True


class WorkOrderBriefOut(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    status: str
    priority: str
    work_order_type: str
    equipment_id: Optional[str] = None
    part_id: Optional[str] = None
    procedure_id: Optional[str] = None
    due_date: Optional[datetime] = None
    assigned_user_id: Optional[str] = None
    attachments: list[Any] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class ProcedureOut(BaseModel):
    id: str
    title: str
    steps: list[Any] = Field(default_factory=list)


class PartLineOut(BaseModel):
    part_id: str
    quantity: int
    name: Optional[str] = None
    description: Optional[str] = None
    equipment_id: Optional[str] = None


class EquipmentHistoryItemOut(BaseModel):
    id: str
    title: str
    status: str
    updated_at: datetime
    work_order_type: Optional[str] = None


class TaskFullOut(BaseModel):
    task: TaskOut
    work_order: Optional[WorkOrderBriefOut] = None
    procedures: list[ProcedureOut] = Field(default_factory=list)
    parts: list[PartLineOut] = Field(default_factory=list)
    attachments: list[Any] = Field(default_factory=list)
    equipment_history: list[EquipmentHistoryItemOut] = Field(default_factory=list)

