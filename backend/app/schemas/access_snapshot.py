"""Canonical access snapshot (``/auth/me`` + debug)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

MatrixSlotSourceOut = Literal[
    "explicit_matrix_slot",
    "jwt_role",
    "job_title_inference",
    "department_baseline",
    "department_default",
    "unresolved",
    "fallback_default",
    "explicit_required_policy",
]


class AccessSnapshotAuditOut(BaseModel):
    assignment_status: str = "unassigned"
    assigned_department_slug: str | None = None
    assigned_role_key: str | None = None
    matrix_slot_source: MatrixSlotSourceOut | None = None
    matrix_slot_inferred: bool = False
    hr_matrix_slot: str | None = None
    is_unresolved: bool = False
    matrix_slot_operational_label: str | None = None
    matrix_slot_source_label: str | None = None
    inference_trace: list[str] = Field(default_factory=list)
    require_explicit_elevated_slots: bool = False
    resolution_warnings: list[str] = Field(default_factory=list)
    denied_by_contract: list[str] = Field(default_factory=list)
    contract_features: list[str] = Field(default_factory=list)


class AccessSnapshotOut(BaseModel):
    department: str
    matrix_slot: str
    assignment_status: str = "unassigned"
    features: list[str] = Field(default_factory=list)
    capabilities: list[str] = Field(default_factory=list)
    departments: list[str] = Field(default_factory=list)
    is_company_admin: bool = False
    workers_roster_access: bool = False
    contract_features: list[str] = Field(default_factory=list)
    denied_features: list[str] = Field(default_factory=list)
    audit: AccessSnapshotAuditOut | None = None
