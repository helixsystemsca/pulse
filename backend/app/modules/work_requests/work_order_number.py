"""Per-tenant sequential work order numbers (WO#0001, …)."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pulse_models import PulseWorkRequest


def format_work_order_display_id(number: int | None) -> str | None:
    if number is None or number < 1:
        return None
    return f"WO#{number:04d}"


async def allocate_work_order_number(db: AsyncSession, company_id: str) -> int:
    """Next sequence for this tenant (call within the same transaction as insert)."""
    r = await db.execute(
        select(func.coalesce(func.max(PulseWorkRequest.work_order_number), 0)).where(
            PulseWorkRequest.company_id == company_id
        )
    )
    return int(r.scalar_one()) + 1
