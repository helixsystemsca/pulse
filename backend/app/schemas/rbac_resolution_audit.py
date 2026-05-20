"""Full-stack RBAC / feature resolution audit (admin debug)."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from app.schemas.access_debug import AccessResolutionDebugOut


class FeatureResolutionLogEntry(BaseModel):
    feature_key: str
    registry_key: str | None = None
    route: str | None = None
    rbac_keys_required: list[str] = Field(default_factory=list)
    sidebar_visible: bool = False
    route_allowed: bool = False
    api_allowed: bool | None = None
    render_allowed: bool = False
    failure_reason: str | None = None
    resolution_notes: list[str] = Field(default_factory=list)


class ResolvedAccessAuditOut(BaseModel):
    user_id: str
    company_id: str | None = None
    department_slug: str | None = None

    assigned_roles: list[str] = Field(default_factory=list)
    department_roles: list[str] = Field(default_factory=list)
    org_roles: list[str] = Field(default_factory=list)

    merged_capabilities: list[str] = Field(default_factory=list)
    legacy_platform_capabilities: list[str] = Field(default_factory=list)
    visible_features: list[str] = Field(default_factory=list)
    denied_features: list[str] = Field(default_factory=list)

    active_department: str | None = None
    workspace_context: dict[str, Any] = Field(default_factory=dict)

    feature_resolution_log: list[FeatureResolutionLogEntry] = Field(default_factory=list)

  #: Production matrix/contract debugger payload (same as GET /debug/access/{user_id}).
    access_debug: AccessResolutionDebugOut
