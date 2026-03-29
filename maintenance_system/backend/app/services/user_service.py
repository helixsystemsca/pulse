from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.domain import User, UserRole
from app.schemas.user import UserCreate, UserUpdate


async def list_users(db: AsyncSession, company_id: str) -> list[User]:
    result = await db.execute(select(User).where(User.company_id == company_id).order_by(User.created_at))
    return list(result.scalars())


async def create_user(db: AsyncSession, company_id: str, data: UserCreate) -> User:
    existing = await db.execute(select(User).where(User.company_id == company_id, User.email == data.email))
    if existing.scalar_one_or_none():
        raise ValueError("Email already in use for this company")
    if data.role == UserRole.system_admin:
        raise ValueError("Cannot assign system role via tenant API")
    user = User(
        company_id=company_id,
        email=data.email,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        role=data.role,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def get_user(db: AsyncSession, company_id: str, user_id: str) -> User | None:
    result = await db.execute(select(User).where(User.company_id == company_id, User.id == user_id))
    return result.scalar_one_or_none()


async def update_user(db: AsyncSession, user: User, data: UserUpdate) -> User:
    if data.full_name is not None:
        user.full_name = data.full_name
    if data.role is not None:
        if data.role == UserRole.system_admin:
            raise ValueError("Invalid role")
        user.role = data.role
    if data.is_active is not None:
        user.is_active = data.is_active
    if data.password is not None:
        user.password_hash = hash_password(data.password)
    await db.flush()
    await db.refresh(user)
    return user
