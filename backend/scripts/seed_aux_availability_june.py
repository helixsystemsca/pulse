"""
Seed June 2026 auxiliary employee availability (development / staging only).

Usage:
  cd backend
  python -m scripts.seed_aux_availability_june

  DEMO_COMPANY_ID=<uuid> python -m scripts.seed_aux_availability_june
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


async def _main() -> None:
    from sqlalchemy import select

    from app.core.config import get_settings
    from app.core.database import AsyncSessionLocal
    from app.models.domain import Company
    from app.services.schedule.employee_availability_service import seed_june_2026_auxiliary

    settings = get_settings()
    if settings.is_production:
        print("Refusing to run in production (environment=production).")
        sys.exit(1)

    company_id = os.getenv("DEMO_COMPANY_ID", "").strip()
    async with AsyncSessionLocal() as db:
        if not company_id:
            row = (await db.execute(select(Company.id).limit(1))).scalar_one_or_none()
            if not row:
                print("No company found. Set DEMO_COMPANY_ID.")
                sys.exit(1)
            company_id = str(row)
        result = await seed_june_2026_auxiliary(db, company_id)
    print(f"Company: {company_id}")
    print(f"Employees matched: {result.employees_matched}")
    print(f"Entries created: {result.entries_created}")
    print(f"Skipped duplicates: {result.entries_skipped_duplicates}")
    print(f"Wiped prior seed rows: {result.wiped_rows}")
    print(f"Execution time: {result.execution_ms}ms")
    if result.employees_missing:
        print("Missing workers (create or rename in roster):")
        for name in result.employees_missing:
            print(f"  - {name}")


if __name__ == "__main__":
    asyncio.run(_main())
