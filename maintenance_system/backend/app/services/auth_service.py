from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password, verify_password
from app.models.domain import Company, User, UserRole
from app.schemas.auth import LoginRequest, RegisterRequest


async def register(db: AsyncSession, data: RegisterRequest) -> User:
    company = Company(name=data.company_name)
    db.add(company)
    await db.flush()
    user = User(
        company_id=company.id,
        email=data.email,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        role=UserRole.company_admin,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def login(db: AsyncSession, data: LoginRequest) -> tuple[User, str]:
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(data.password, user.password_hash):
        raise ValueError("Invalid email or password")
    if not user.is_active:
        raise ValueError("Account disabled")
    token = create_access_token(
        user.id,
        extra_claims={
            "company_id": user.company_id,
            "role": user.role.value,
            "system_admin": user.role == UserRole.system_admin,
        },
    )
    return user, token
