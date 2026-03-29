"""
Create or update the internal system admin (jc@helixpulse.com).

Usage (from the `backend` directory):
    set SYS_ADMIN_PASSWORD=your-secret-here
    python -m scripts.seed_sys_admin

Requires PostgreSQL and DATABASE_URL in `.env` (same as the API).
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

# Add backend root to path when run as script
_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))


async def _main() -> None:
    pwd = os.environ.get("SYS_ADMIN_PASSWORD", "").strip()
    if len(pwd) < 8:
        print("ERROR: Set SYS_ADMIN_PASSWORD (minimum 8 characters).")
        raise SystemExit(1)

    from sqlalchemy import select

    from app.core.auth.security import hash_password
    from app.core.database import AsyncSessionLocal
    from app.models.domain import User, UserRole

    email = "jc@helixpulse.com"
    async with AsyncSessionLocal() as db:
        q = await db.execute(select(User).where(User.email == email))
        u = q.scalar_one_or_none()
        if u:
            u.hashed_password = hash_password(pwd)
            u.role = UserRole.system_admin
            u.company_id = None
            u.is_system_admin = True
            u.is_active = True
            u.full_name = u.full_name or "System Admin"
        else:
            db.add(
                User(
                    email=email,
                    hashed_password=hash_password(pwd),
                    full_name="System Admin",
                    role=UserRole.system_admin,
                    company_id=None,
                    is_system_admin=True,
                    is_active=True,
                )
            )
        await db.commit()
    print(f"OK: system admin ready -> {email}")


if __name__ == "__main__":
    asyncio.run(_main())
