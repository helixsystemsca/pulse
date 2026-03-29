from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.domain import UserRole
from app.schemas.common import ORMModel


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = ""
    role: UserRole = UserRole.worker


class UserUpdate(BaseModel):
    full_name: str | None = None
    role: UserRole | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=8)


class UserOut(ORMModel):
    id: str
    company_id: str
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    created_at: datetime


class UserMe(UserOut):
    pass
