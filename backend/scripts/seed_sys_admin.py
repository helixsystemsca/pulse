"""
Create or update the internal system admin (Helix Systems domain).

Usage — pick one:

    cd backend
    python -m scripts.seed_sys_admin

From the repo root (`Helix_Systems`):

    python backend/scripts/seed_sys_admin.py

Loads `SYS_ADMIN_EMAIL` (default josh.collins@helixsystems.ca), `SYS_ADMIN_PASSWORD`, and `DATABASE_URL`
from `backend/.env` (same as the API). Override via environment variables.
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# Add backend root to path when run as script
_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

load_dotenv(_ROOT / ".env")


async def _main() -> None:
    pwd = os.environ.get("SYS_ADMIN_PASSWORD", "").strip()
    if len(pwd) < 8:
        print("ERROR: Set SYS_ADMIN_PASSWORD (minimum 8 characters).")
        raise SystemExit(1)

    email = os.environ.get("SYS_ADMIN_EMAIL", "josh.collins@helixsystems.ca").strip().lower()
    if not email or "@" not in email:
        print("ERROR: Set SYS_ADMIN_EMAIL to a valid email address.")
        raise SystemExit(1)

    from sqlalchemy import select

    from app.core.auth.security import hash_password
    from app.core.database import AsyncSessionLocal
    from app.models.domain import User, UserRole
    async with AsyncSessionLocal() as db:
        q = await db.execute(select(User).where(User.email == email))
        u = q.scalar_one_or_none()
        if u:
            u.hashed_password = hash_password(pwd)
            u.roles = [UserRole.system_admin.value]
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
                    roles=[UserRole.system_admin.value],
                    company_id=None,
                    is_system_admin=True,
                    is_active=True,
                )
            )
        await db.commit()
    print(f"OK: system admin ready -> {email}")


if __name__ == "__main__":
    asyncio.run(_main())
