"""
Create/update a Demo Viewer account for presentations.

Usage (from backend/):
  python -m scripts.seed_demo_viewer

Env overrides:
  DEMO_VIEWER_EMAIL (default: team@panorama.ca)
  DEMO_VIEWER_PASSWORD (required; no default)
"""

from __future__ import annotations

import os
import asyncio

from sqlalchemy import select, func

from app.core.auth.security import hash_password
from app.core.database import AsyncSessionLocal
from app.models.domain import User, UserRole, UserAccountStatus


async def main() -> None:
    email = (os.getenv("DEMO_VIEWER_EMAIL") or "team@panorama.ca").strip().lower()
    pw = os.getenv("DEMO_VIEWER_PASSWORD")
    if not pw or len(pw) < 8:
        raise RuntimeError("Set DEMO_VIEWER_PASSWORD (min 8 chars)")

    async with AsyncSessionLocal() as db:
        q = await db.execute(select(User).where(func.lower(User.email) == email))
        u = q.scalar_one_or_none()
        if u is None:
            u = User(
                email=email,
                company_id=None,
                hashed_password=hash_password(pw),
                full_name="Demo Viewer",
                roles=[UserRole.demo_viewer.value],
                account_status=UserAccountStatus.active,
                is_active=True,
            )
            db.add(u)
        else:
            u.hashed_password = hash_password(pw)
            u.roles = [UserRole.demo_viewer.value]
            u.account_status = UserAccountStatus.active
            u.is_active = True
        await db.commit()

    print(f"Seeded demo_viewer: {email}")


if __name__ == "__main__":
    asyncio.run(main())

