from pydantic import BaseModel, EmailStr, Field

from app.schemas.user import UserOut


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AuthResponse(Token):
    user: UserOut


class TokenPayload(BaseModel):
    sub: str
    company_id: str | None = None
    system_admin: bool = False


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = ""
    company_name: str = Field(min_length=1, description="Creates a company tenant on first signup")
