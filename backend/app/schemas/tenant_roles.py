"""Schemas for tenant role CRUD (`/api/workers/tenant-roles`)."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.features.canonical_catalog import canonicalize_feature_keys
from app.core.tenant_roles import normalize_role_slug


class TenantRoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    company_id: str
    slug: str
    name: str
    department_id: Optional[str] = None
    feature_keys: list[str] = Field(default_factory=list)
    user_count: int = 0
    created_at: datetime


class TenantRoleCreateIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    slug: Optional[str] = Field(None, max_length=96)
    department_id: Optional[str] = None
    feature_keys: list[str] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def _default_slug(cls, data: object) -> object:
        if isinstance(data, dict) and not (data.get("slug") or "").strip():
            name = data.get("name")
            if isinstance(name, str) and name.strip():
                data = {**data, "slug": normalize_role_slug(name)}
        return data

    @field_validator("slug", mode="before")
    @classmethod
    def _slug(cls, v: object) -> str:
        if v is None or (isinstance(v, str) and not str(v).strip()):
            raise ValueError("slug is required")
        return normalize_role_slug(str(v))

    @field_validator("feature_keys", mode="before")
    @classmethod
    def _features(cls, v: object) -> list[str]:
        if v is None:
            return []
        if not isinstance(v, list):
            return []
        return canonicalize_feature_keys(str(x) for x in v)


class TenantRolePatchIn(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    slug: Optional[str] = Field(None, max_length=96)
    department_id: Optional[str] = None
    feature_keys: Optional[list[str]] = None

    @field_validator("slug", mode="before")
    @classmethod
    def _slug_opt(cls, v: object) -> Optional[str]:
        if v is None:
            return None
        s = str(v).strip()
        if not s:
            return None
        return normalize_role_slug(s)

    @field_validator("feature_keys", mode="before")
    @classmethod
    def _features(cls, v: object) -> Optional[list[str]]:
        if v is None:
            return None
        if not isinstance(v, list):
            return []
        return canonicalize_feature_keys(str(x) for x in v)


class TenantRoleListOut(BaseModel):
    items: list[TenantRoleOut]
    catalog_feature_keys: list[str] = Field(
        default_factory=list,
        description="Canonical keys available for toggles (intersect with tenant contract in UI).",
    )
