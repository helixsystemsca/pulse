"""Canonical access snapshot (``/auth/me`` + debug)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

MatrixSlotSourceOut = Literal[
    "explicit_matrix_slot",
    "jwt_role",
    "job_title_inference",
    "fallback_default",
]


class AccessSnapshotAuditOut(BaseModel):
    matrix_slot_source: MatrixSlotSourceOut
    matrix_slot_inferred: bool
    hr_matrix_slot: str | None = None
    likely_elevated: bool = False
    likely_elevated_reasons: list[str] = Field(default_factory=list)
    recommended_matrix_slot: str | None = None
    inference_trace: list[str] = Field(default_factory=list)
    require_explicit_elevated_slots: bool = False
    resolution_warnings: list[str] = Field(default_factory=list)
    denied_by_contract: list[str] = Field(default_factory=list)
    contract_features: list[str] = Field(default_factory=list)


class AccessSnapshotOut(BaseModel):
    department: str
    matrix_slot: str
    features: list[str] = Field(default_factory=list)
    capabilities: list[str] = Field(default_factory=list)
    departments: list[str] = Field(default_factory=list)
    is_company_admin: bool = False
    workers_roster_access: bool = False
    contract_features: list[str] = Field(default_factory=list)
    denied_features: list[str] = Field(default_factory=list)
    audit: AccessSnapshotAuditOut | None = None
