"""Operational XP, recognitions, and tenant operator configuration APIs."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

RecognitionType = Literal[
    "peer_appreciation",
    "cross_department",
    "supervisor_commendation",
    "assisted_team",
]


class OperationalXpConfigOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    recognition_requires_approval: bool = Field(False, alias="recognitionRequiresApproval")
    recognition_monthly_limit_per_user: int = Field(12, alias="recognitionMonthlyLimitPerUser")
    recognition_max_per_target_per_month: int = Field(4, alias="recognitionMaxPerTargetPerMonth")
    category_daily_xp_caps: dict[str, int] = Field(default_factory=dict, alias="categoryDailyXpCaps")
    professional_level_thresholds: Optional[list[int]] = Field(None, alias="professionalLevelThresholds")


class OperationalXpConfigPatchIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    recognition_requires_approval: Optional[bool] = Field(None, alias="recognitionRequiresApproval")
    recognition_monthly_limit_per_user: Optional[int] = Field(None, ge=1, le=100, alias="recognitionMonthlyLimitPerUser")
    recognition_max_per_target_per_month: Optional[int] = Field(None, ge=1, le=50, alias="recognitionMaxPerTargetPerMonth")
    category_daily_xp_caps: Optional[dict[str, int]] = Field(None, alias="categoryDailyXpCaps")
    professional_level_thresholds: Optional[list[int]] = Field(None, alias="professionalLevelThresholds")


class RecognitionCreateIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    to_worker_id: str = Field(min_length=1, alias="toWorkerId")
    recognition_type: RecognitionType = Field(alias="recognitionType")
    comment: str = Field(min_length=8, max_length=2000)


class RecognitionOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    from_worker_id: str = Field(alias="fromWorkerId")
    to_worker_id: str = Field(alias="toWorkerId")
    from_department: Optional[str] = Field(None, alias="fromDepartment")
    to_department: Optional[str] = Field(None, alias="toDepartment")
    recognition_type: str = Field(alias="recognitionType")
    comment: str
    status: str
    approved_by_user_id: Optional[str] = Field(None, alias="approvedByUserId")
    approved_at: Optional[datetime] = Field(None, alias="approvedAt")
    created_at: datetime = Field(alias="createdAt")


class RecognitionApproveIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    approve: bool = True


RECOGNITION_XP: dict[str, int] = {
    "peer_appreciation": 5,
    "cross_department": 15,
    "supervisor_commendation": 20,
    "assisted_team": 10,
}
