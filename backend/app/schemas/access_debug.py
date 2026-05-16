"""API models for access resolution debugger (admin-only)."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class MissingFeatureExplanationOut(BaseModel):
    feature_key: str
    expected_from: list[str] = Field(default_factory=list)
    denied_by: list[str] = Field(default_factory=list)
    missing_reason: str = ""
    resolution_details: list[str] = Field(default_factory=list)


class AccessResolutionDebugOut(BaseModel):
    user_id: str
    company_id: str | None = None

    jwt_roles: list[str] = Field(default_factory=list)

    hr_job_title: str | None = None
    user_job_title: str | None = None
    effective_job_title: str | None = None
    hr_department: str | None = None
    hr_department_slugs: list[str] = Field(default_factory=list)

    resolved_department: str | None = None
    resolved_slot: str | None = None
    resolved_slot_source: str = ""
    hr_matrix_slot: str | None = None
    matrix_slot_display: str = ""
    likely_elevated: bool = False
    likely_elevated_reasons: list[str] = Field(default_factory=list)
    recommended_matrix_slot: str | None = None
    matrix_slot_inference_trace: list[str] = Field(default_factory=list)
    require_explicit_elevated_slots: bool = False
    policy_suppressed: bool = False
    suppressed_inferred_slot: str | None = None

    matrix_configured: bool = False
    matrix_row_department: str | None = None
    matrix_row_slot: str | None = None
    matrix_cell_raw_features: list[str] = Field(default_factory=list)
    matrix_missing_cell: bool = False

    contract_features: list[str] = Field(default_factory=list)
    matrix_features: list[str] = Field(default_factory=list)
    overlay_features: list[str] = Field(default_factory=list)
    feature_allow_extra: list[str] = Field(default_factory=list)
    feature_deny_extra: list[str] = Field(default_factory=list)

    denied_by_contract: list[str] = Field(default_factory=list)

    effective_enabled_features: list[str] = Field(default_factory=list)
    rbac_permission_keys: list[str] = Field(default_factory=list)

    tenant_role_id: str | None = None
    tenant_role_slug: str | None = None
    tenant_role_name: str | None = None

    resolution_kind: str = ""
    source_attribution: dict[str, str] = Field(default_factory=dict)

    legacy_bucket: str | None = None
    legacy_role_feature_access_features: list[str] = Field(default_factory=list)

    resolution_steps: list[str] = Field(default_factory=list)
    session_cache_info: dict[str, Any] | None = None
    warnings: list[str] = Field(default_factory=list)

    missing_feature_explanations: list[MissingFeatureExplanationOut] = Field(default_factory=list)
    candidate_feature_keys: list[str] = Field(default_factory=list)
    missing_rbac_permission_keys: list[str] = Field(default_factory=list)
