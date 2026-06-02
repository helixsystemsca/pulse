"""Schemas for tenant department CRUD (`/api/workers/tenant-departments`)."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.tenant_departments import normalize_department_slug_format, slug_from_department_name


class TenantDepartmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    company_id: str
    slug: str
    name: str
    created_at: datetime


class TenantDepartmentListOut(BaseModel):
    items: list[TenantDepartmentOut]


class TenantDepartmentCreateIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    slug: Optional[str] = Field(None, max_length=64)

    @field_validator("slug", mode="before")
    @classmethod
    def _slug(cls, v: object) -> Optional[str]:
        if v is None or (isinstance(v, str) and not str(v).strip()):
            return None
        norm = normalize_department_slug_format(str(v))
        if not norm:
            raise ValueError("Invalid department slug")
        return norm


class TenantDepartmentPatchIn(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)


def default_slug_for_create(name: str, slug: str | None) -> str:
    if slug:
        return slug
    return slug_from_department_name(name)
