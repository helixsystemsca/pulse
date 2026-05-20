"""Response models for RBAC introspection (admin / support tooling)."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class PermissionSourceRow(BaseModel):
    key: str
    sources: list[str]


class CatalogPermissionOut(BaseModel):
    key: str
    description: str
    requires_company_feature: str | None = None


class RbacIntrospectionOut(BaseModel):
    user_id: str
    company_id: str | None = None
    jwt_roles: list[str] = Field(default_factory=list)
    tenant_role_id: str | None = None
    contract_features: list[str] = Field(default_factory=list)
    matrix_effective_features: list[str] = Field(default_factory=list)
    feature_allow_extra: list[str] = Field(default_factory=list)
    effective_rbac_keys: list[str] = Field(default_factory=list)
    denied_catalog_keys: list[str] = Field(default_factory=list)
    resolution_summary: str
    workers_roster_delegation: bool = False
    permission_sources: list[PermissionSourceRow] = Field(default_factory=list)
    feature_to_rbac_bridge: dict[str, list[str]] = Field(default_factory=dict)
    catalog: list[CatalogPermissionOut] = Field(default_factory=list)

    model_config = {"extra": "ignore"}

    @classmethod
    def from_introspect_dict(cls, raw: dict[str, Any]) -> RbacIntrospectionOut:
        cat = raw.get("catalog") or []
        catalog = [CatalogPermissionOut.model_validate(x) if isinstance(x, dict) else x for x in cat]
        ps = raw.get("permission_sources") or []
        permission_sources = [
            PermissionSourceRow.model_validate(x) if isinstance(x, dict) else x for x in ps
        ]
        data = {**raw, "catalog": catalog, "permission_sources": permission_sources}
        return cls.model_validate(data)
