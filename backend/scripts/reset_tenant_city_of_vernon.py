"""
Rename the primary tenant to City of Vernon and remove all company users (0 employees).

Keeps the company row and platform system_admin accounts (company_id IS NULL).
Does NOT delete operational CMMS data (equipment, inventory, etc.) — only tenant users
and optional ops people if CLEAR_OPS_PEOPLE=true.

Usage
-----
  cd backend
  # Preview (no writes):
  python -m scripts.reset_tenant_city_of_vernon --dry-run

  # Apply:
  python -m scripts.reset_tenant_city_of_vernon

  # Target a specific company:
  COMPANY_ID=<uuid> python -m scripts.reset_tenant_city_of_vernon

  # Also clear recreation-ops people / skills / risks for a clean org slate:
  CLEAR_OPS_PEOPLE=true python -m scripts.reset_tenant_city_of_vernon

Env
---
  DATABASE_URL          — required (from .env)
  COMPANY_ID            — optional; otherwise matches name ilike '%panorama%' or first active company
  NEW_COMPANY_NAME      — default "City of Vernon"
  CLEAR_OPS_PEOPLE      — if true, delete ops_people + related Phase 2 org rows for that company
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from dotenv import load_dotenv

load_dotenv(_ROOT / ".env")


async def _main(*, dry_run: bool) -> None:
    from sqlalchemy import delete, func, select, text

    from app.core.database import AsyncSessionLocal
    from app.models.domain import Company, User
    from app.models.ops_command_models import (
        OpsDevelopmentPlan,
        OpsSkill,
        OpsSkillRating,
        OpsTeamRisk,
    )
    from app.models.ops_foundation_models import OpsPerson

    new_name = (os.getenv("NEW_COMPANY_NAME") or "City of Vernon").strip()
    company_id = (os.getenv("COMPANY_ID") or "").strip() or None
    clear_ops = os.getenv("CLEAR_OPS_PEOPLE", "").lower() in ("true", "1", "yes")

    async with AsyncSessionLocal() as db:
        company: Company | None = None
        if company_id:
            company = await db.get(Company, company_id)
        else:
            # Prefer a Panorama-named tenant; else first active company.
            company = (
                await db.execute(
                    select(Company)
                    .where(Company.name.ilike("%panorama%"))
                    .order_by(Company.created_at.asc())
                    .limit(1)
                )
            ).scalar_one_or_none()
            if not company:
                company = (
                    await db.execute(
                        select(Company).where(Company.is_active.is_(True)).order_by(Company.created_at.asc()).limit(1)
                    )
                ).scalar_one_or_none()

        if not company:
            print("No company found. Create a tenant first or set COMPANY_ID.")
            sys.exit(1)

        cid = str(company.id)
        users = list(
            (await db.execute(select(User).where(User.company_id == cid).order_by(User.email))).scalars().all()
        )
        people_n = int(
            (
                await db.execute(select(func.count()).select_from(OpsPerson).where(OpsPerson.company_id == cid))
            ).scalar_one()
            or 0
        )

        print(f"Company: {company.name!r} ({cid})")
        print(f"Rename → {new_name!r}")
        print(f"Tenant users to delete: {len(users)}")
        for u in users:
            print(f"  - {u.email} roles={list(u.roles or [])}")
        print(f"Ops people records: {people_n}" + (" (will clear)" if clear_ops else " (kept)"))
        if dry_run:
            print("Dry run — no changes written.")
            return

        company.name = new_name
        # Clear branding that still points at old tenant assets if present
        if company.logo_url and "panorama" in str(company.logo_url).lower():
            company.logo_url = None
        if company.header_image_url and "panorama" in str(company.header_image_url).lower():
            company.header_image_url = None

        if clear_ops:
            await db.execute(delete(OpsSkillRating).where(OpsSkillRating.company_id == cid))
            await db.execute(delete(OpsDevelopmentPlan).where(OpsDevelopmentPlan.company_id == cid))
            await db.execute(delete(OpsTeamRisk).where(OpsTeamRisk.company_id == cid))
            await db.execute(delete(OpsSkill).where(OpsSkill.company_id == cid))
            # Break self-FK then delete people
            await db.execute(
                text("UPDATE ops_people SET reports_to_person_id = NULL WHERE company_id = :cid"),
                {"cid": cid},
            )
            await db.execute(delete(OpsPerson).where(OpsPerson.company_id == cid))

        for u in users:
            await db.execute(delete(User).where(User.id == u.id))

        await db.commit()

        remaining = int(
            (await db.execute(select(func.count()).select_from(User).where(User.company_id == cid))).scalar_one()
            or 0
        )
        print(f"Done. Company is {new_name!r} with {remaining} employees.")
        print("Sign in as a platform system_admin, then invite a City of Vernon admin when ready.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Reset tenant to City of Vernon with 0 employees")
    parser.add_argument("--dry-run", action="store_true", help="Show plan without writing")
    args = parser.parse_args()
    if not os.getenv("DATABASE_URL"):
        print("DATABASE_URL is not set. Add backend/.env or export it.")
        sys.exit(1)
    asyncio.run(_main(dry_run=args.dry_run))


if __name__ == "__main__":
    main()
