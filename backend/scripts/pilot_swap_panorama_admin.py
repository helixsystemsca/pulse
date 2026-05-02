"""
One-off pilot fix: move company_admin from Liz → Josh (Panorama tenant).

**Preferred:** use System Admin UI → Company → **Tenant owner (canonical)** → Transfer owner
(`POST /api/system/companies/{id}/transfer-tenant-owner`). That updates both `users.roles` and
`companies.owner_admin_id`, so `/system/users` stays the source of truth.

This script is a DB-only fallback when the API is not available.

  - liz@panorama.ca     → manager
  - josh@panorama.ca    → company_admin + companies.owner_admin_id
  - josh.collins@helixsystems.ca → untouched (expected platform system admin)

Idempotent: safe to re-run if state already matches.

Usage (from backend/, DATABASE_URL set):
  python -m scripts.pilot_swap_panorama_admin

Optional env overrides:
  PILOT_LIZ_EMAIL, PILOT_JOSH_ADMIN_EMAIL, PILOT_SYSADMIN_EMAIL (verification only)
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

EMAIL_LIZ = os.environ.get("PILOT_LIZ_EMAIL", "liz@panorama.ca").strip().lower()
EMAIL_JOSH = os.environ.get("PILOT_JOSH_ADMIN_EMAIL", "josh@panorama.ca").strip().lower()
EMAIL_SYS = os.environ.get("PILOT_SYSADMIN_EMAIL", "josh.collins@helixsystems.ca").strip().lower()


async def _main() -> None:
    from sqlalchemy import func, select

    from app.core.database import AsyncSessionLocal
    from app.core.user_roles import default_operational_role_for_invite_role, validate_tenant_roles_non_empty
    from app.models.domain import Company, User, UserRole

    async with AsyncSessionLocal() as db:
        q_liz = await db.execute(select(User).where(func.lower(User.email) == EMAIL_LIZ))
        q_josh = await db.execute(select(User).where(func.lower(User.email) == EMAIL_JOSH))
        liz = q_liz.scalar_one_or_none()
        josh = q_josh.scalar_one_or_none()

        if not liz or not liz.company_id:
            print(f"ERROR: User not found or missing company: {EMAIL_LIZ!r}")
            return
        if not josh or not josh.company_id:
            print(f"ERROR: User not found or missing company: {EMAIL_JOSH!r}")
            return
        if str(liz.company_id) != str(josh.company_id):
            print("ERROR: Liz and Josh must belong to the same company.")
            return

        company = await db.get(Company, str(liz.company_id))
        if not company:
            print("ERROR: Company row missing.")
            return

        q_sys = await db.execute(select(User).where(func.lower(User.email) == EMAIL_SYS))
        sys_u = q_sys.scalar_one_or_none()
        if sys_u and not sys_u.is_system_admin:
            print(
                f"WARNING: {EMAIL_SYS!r} exists but is_system_admin is false "
                "(expected platform admin — check seed_sys_admin)."
            )
        elif sys_u is None:
            print(f"NOTE: No user {EMAIL_SYS!r} — skipping system-admin verification.")

        liz_roles = validate_tenant_roles_non_empty([UserRole.manager.value])
        josh_roles = validate_tenant_roles_non_empty([UserRole.company_admin.value])

        changed: list[str] = []

        if list(liz.roles) != liz_roles:
            liz.roles = liz_roles
            liz.operational_role = default_operational_role_for_invite_role(UserRole.manager)
            changed.append(f"{EMAIL_LIZ} → roles={liz_roles}")

        if list(josh.roles) != josh_roles:
            josh.roles = josh_roles
            josh.operational_role = default_operational_role_for_invite_role(UserRole.company_admin)
            changed.append(f"{EMAIL_JOSH} → roles={josh_roles}")

        new_owner = str(josh.id)
        if str(company.owner_admin_id or "") != new_owner:
            company.owner_admin_id = new_owner
            changed.append(f"company {company.name!r} owner_admin_id → {new_owner[:8]}…")

        if not changed:
            print("Already applied — no changes.")
            return

        await db.commit()
        print("OK — applied:")
        for line in changed:
            print(f"  • {line}")


if __name__ == "__main__":
    asyncio.run(_main())
