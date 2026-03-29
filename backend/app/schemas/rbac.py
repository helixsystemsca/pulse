from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class CompanyUserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: Optional[str] = Field(None, max_length=255)
    role: str = Field(..., pattern="^(manager|worker)$")


class AssignRoleBody(BaseModel):
    role: str = Field(..., pattern="^(manager|worker)$")


class RolePermissionsPut(BaseModel):
    """Permissions template for manager or worker in this company."""

    role: str = Field(..., pattern="^(manager|worker)$")
    allow: list[str] = Field(default_factory=list)


class WorkerDenyPatch(BaseModel):
    """Manager tightens a worker's effective permissions via deny list."""

    deny: list[str] = Field(default_factory=list)
