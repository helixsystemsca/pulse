"""Optional dev/bootstrap: first system_admin from env, Pulse tenant admin from env."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth.security import hash_password
from app.core.config import get_settings
from app.core.company_features import sync_enabled_features
from app.core.features.service import MODULE_KEYS
from app.models.domain import Company, User, UserRole


async def ensure_bootstrap_system_admin(db: AsyncSession) -> None:
    settings = get_settings()
    if not settings.bootstrap_system_admin_email or not settings.bootstrap_system_admin_password:
        return
    q = await db.execute(select(User).where(User.role == UserRole.system_admin).limit(1))
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
            role=UserRole.system_admin,
            company_id=None,
            created_by=None,
            is_system_admin=True,
        )
    )
    await db.commit()


async def ensure_pulse_bootstrap_tenant_admin(db: AsyncSession) -> None:
    """Create a company + company_admin when PULSE_BOOTSTRAP_TENANT_* env is set."""
    settings = get_settings()
    if not settings.pulse_bootstrap_tenant_email or not settings.pulse_bootstrap_tenant_password:
        return
    exists = await db.execute(select(User).where(User.email == settings.pulse_bootstrap_tenant_email))
    if exists.scalar_one_or_none():
        return

    company = Company(
        name=settings.pulse_bootstrap_tenant_company_name,
        owner_admin_id=None,
    )
    db.add(company)
    await db.flush()
    await sync_enabled_features(db, company.id, list(MODULE_KEYS))

    local = settings.pulse_bootstrap_tenant_email.split("@", 1)[0]
    admin = User(
        company_id=company.id,
        email=settings.pulse_bootstrap_tenant_email,
        hashed_password=hash_password(settings.pulse_bootstrap_tenant_password),
        full_name=local or "Tenant Admin",
        role=UserRole.company_admin,
        created_by=None,
    )
    db.add(admin)
    await db.flush()

    company.owner_admin_id = admin.id
    await db.commit()
