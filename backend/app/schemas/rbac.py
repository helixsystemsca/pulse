from typing import Optional

from pydantic import BaseModel, EmailStr, Field, model_validator


class CompanyUserCreate(BaseModel):
    email: EmailStr
    full_name: Optional[str] = Field(None, max_length=255)
    role: str = Field(..., pattern="^(manager|worker|lead|supervisor)$")


class AssignRoleBody(BaseModel):
    role: Optional[str] = Field(None, pattern="^(manager|worker|lead|supervisor)$")
    roles: Optional[list[str]] = None

    @model_validator(mode="after")
    def _require_one(self) -> "AssignRoleBody":
        if self.roles is not None and len(self.roles) > 0:
            return self
        if self.role is not None:
            return self
        raise ValueError("Provide role (single) or roles (list)")


class RolePermissionsPut(BaseModel):
    """Permissions template for manager or worker in this company."""

    role: str = Field(..., pattern="^(manager|worker)$")
    allow: list[str] = Field(default_factory=list)


class WorkerDenyPatch(BaseModel):
    """Manager tightens a worker's effective permissions via deny list."""

    deny: list[str] = Field(default_factory=list)
