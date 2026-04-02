"""Request/response models for `/api/compliance` list, summary, and flag body."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

EffectiveComplianceStatus = Literal["completed", "pending", "overdue", "ignored"]


class ComplianceSummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    compliance_rate: float = Field(..., description="0–100, completed / closed items in window")
    compliance_rate_trend_pct: float = Field(
        0.0, description="Change vs previous period of same length (percentage points)"
    )
    missed_count: int = Field(..., description="Overdue or ignored items")
    missed_severity: Literal["stable", "warning", "critical"] = "stable"
    high_risk_count: int = Field(0, description="Violations on tools with active compliance rules")
    active_monitors: int = Field(0, description="Distinct tools with compliance rules")
    as_of: datetime


class ComplianceRecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    company_id: str
    user_id: str
    user_name: Optional[str] = None
    user_role: Optional[str] = None
    tool_id: Optional[str] = None
    tool_name: Optional[str] = None
    sop_id: Optional[str] = None
    sop_label: Optional[str] = None
    category: str
    status: str
    effective_status: EffectiveComplianceStatus
    ignored: bool
    flagged: bool
    required_at: datetime
    completed_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    repeat_offender: bool = False
    created_at: datetime


class ComplianceListOut(BaseModel):
    items: list[ComplianceRecordOut]
    total: int


class ComplianceFlagBody(BaseModel):
    flagged: bool = True
