"""Optional dev/bootstrap: first system_admin from env."""

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import array as pg_array
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth.security import hash_password
from app.core.config import get_settings
from app.models.domain import User, UserRole


async def ensure_bootstrap_system_admin(db: AsyncSession) -> None:
    settings = get_settings()
    if not settings.bootstrap_system_admin_email or not settings.bootstrap_system_admin_password:
        return
    q = await db.execute(
        select(User).where(User.roles.overlap(pg_array(UserRole.system_admin.value))).limit(1)
    )
    if q.scalar_one_or_none():
        return
    exists = await db.execute(select(User).where(User.email == settings.bootstrap_system_admin_email))
    if exists.scalar_one_or_none():
        return
    db.add(
        User(
            email=settings.bootstrap_system_admin_email,
            hashed_password=hash_password(settings.bootstrap_system_admin_password),
            full_name="System Administrator",
            roles=[UserRole.system_admin.value],
            company_id=None,
            created_by=None,
            is_system_admin=True,
        )
    )
    await db.commit()
