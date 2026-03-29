from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from app.core.security import hash_password
from app.database import AsyncSessionLocal
from app.models.domain import Asset, Company, PMFrequency, PMSchedule, User, UserRole


async def seed_demo_if_empty() -> None:
    async with AsyncSessionLocal() as session:
        count = await session.scalar(select(func.count()).select_from(User))
        if count:
            return
        company = Company(name="Demo Manufacturing")
        session.add(company)
        await session.flush()
        pwd = hash_password("demo12345")
        admin = User(
            company_id=company.id,
            email="admin@demo.example.com",
            password_hash=pwd,
            full_name="Company Admin",
            role=UserRole.company_admin,
        )
        manager = User(
            company_id=company.id,
            email="manager@demo.example.com",
            password_hash=pwd,
            full_name="Site Manager",
            role=UserRole.manager,
        )
        tech = User(
            company_id=company.id,
            email="tech@demo.example.com",
            password_hash=pwd,
            full_name="Technician",
            role=UserRole.worker,
        )
        session.add_all([admin, manager, tech])
        await session.flush()
        asset = Asset(
            company_id=company.id,
            external_id="AST-001",
            name="Line 3 Conveyor",
            asset_type="conveyor",
            location="Building A",
            created_by_user_id=admin.id,
        )
        session.add(asset)
        await session.flush()
        session.add(
            PMSchedule(
                company_id=company.id,
                name="Conveyor lubrication",
                asset_id=asset.id,
                frequency=PMFrequency.weekly,
                interval_days=None,
                assigned_to_user_id=tech.id,
                next_due_at=datetime.now(timezone.utc) + timedelta(days=3),
                is_active=True,
            )
        )
        await session.commit()
