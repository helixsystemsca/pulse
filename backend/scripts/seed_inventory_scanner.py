"""
Create/update the dedicated inventory scanner kiosk account.

Usage (from backend/):
  python -m scripts.seed_inventory_scanner

Env:
  SCANNER_USER_EMAIL (default: scanner@panorama.ca)
  SCANNER_USER_PASSWORD (required; min 8 chars)
  SCANNER_COMPANY_ID (optional — first company when unset)
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from dotenv import load_dotenv

load_dotenv(_ROOT / ".env")

from sqlalchemy import func, select

from app.core.auth.security import hash_password
from app.core.equipment_roster import EQUIPMENT_ROSTER_DEPARTMENT
from app.core.database import AsyncSessionLocal
from app.core.features.service import sync_enabled_features
from app.core.tenant_roles import assign_user_tenant_role, create_or_fetch_tenant_role
from app.models.domain import Company, User, UserRole
from app.models.pulse_models import PulseWorkerHR


async def main() -> None:
    email = (os.getenv("SCANNER_USER_EMAIL") or "scanner@panorama.ca").strip().lower()
    password = (os.getenv("SCANNER_USER_PASSWORD") or "").strip()
    if len(password) < 8:
        raise RuntimeError("Set SCANNER_USER_PASSWORD (min 8 chars)")

    company_id = (os.getenv("SCANNER_COMPANY_ID") or "").strip()

    async with AsyncSessionLocal() as db:
        if not company_id:
            row = (await db.execute(select(Company).order_by(Company.name.asc()).limit(1))).scalar_one_or_none()
            if row is None:
                raise RuntimeError("No company found — create a tenant first or set SCANNER_COMPANY_ID")
            company_id = str(row.id)

        company = await db.get(Company, company_id)
        if company is None:
            raise RuntimeError(f"Unknown company_id={company_id}")

        await sync_enabled_features(db, company_id, ["inventory", "inventory_scanner"])

        role = await create_or_fetch_tenant_role(
            db,
            company_id,
            slug="inventory_scanner",
            name="Inventory Scanner",
            feature_keys=["inventory_scanner"],
        )

        q = await db.execute(select(User).where(func.lower(User.email) == email))
        user = q.scalar_one_or_none()
        onboarding_done = {
            "onboardingTours": {
                "completed": {
                    "dashboard-overview": True,
                    "dashboard-worker": True,
                    "feature-inventory_scanner": True,
                }
            }
        }
        if user is None:
            user = User(
                email=email,
                company_id=company_id,
                hashed_password=hash_password(password),
                full_name="Inventory Scanner",
                roles=[UserRole.worker.value],
                operational_role="worker",
                is_active=True,
                feature_allow_extra=["inventory_scanner"],
                rbac_permission_extra=["inventory.scan"],
                ui_preferences=onboarding_done,
            )
            db.add(user)
            await db.flush()
        else:
            user.company_id = company_id
            user.hashed_password = hash_password(password)
            user.full_name = "Inventory Scanner"
            user.roles = [UserRole.worker.value]
            user.is_active = True
            user.feature_allow_extra = ["inventory_scanner"]
            user.rbac_permission_extra = ["inventory.scan"]
            prefs = dict(user.ui_preferences or {})
            prefs.update(onboarding_done)
            user.ui_preferences = prefs

        await assign_user_tenant_role(db, user, role)

        hr = await db.get(PulseWorkerHR, user.id)
        if hr is None:
            db.add(
                PulseWorkerHR(
                    user_id=user.id,
                    company_id=company_id,
                    department=EQUIPMENT_ROSTER_DEPARTMENT,
                    job_title="Inventory Scanner",
                )
            )
        else:
            hr.department = EQUIPMENT_ROSTER_DEPARTMENT
            hr.job_title = "Inventory Scanner"

        await db.commit()

    print(f"Seeded inventory scanner user: {email} (company_id={company_id})")


if __name__ == "__main__":
    asyncio.run(main())
