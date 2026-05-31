"""Assemble operations dashboard bootstrap in one HTTP response."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import User
from app.modules.pulse.read_queries import (
    fetch_assets,
    fetch_beacon_equipment,
    fetch_dashboard,
    fetch_low_stock_inventory,
    fetch_schedule_facilities,
    fetch_schedule_shifts,
    fetch_work_requests_page,
    fetch_workers_roster,
)
from app.schemas.pulse_bootstrap import DashboardBootstrapOut


async def build_dashboard_bootstrap(
    db: AsyncSession,
    cid: str,
    user: User,
    *,
    shifts_from: Optional[datetime] = None,
    shifts_to: Optional[datetime] = None,
    work_request_limit: int = 40,
) -> DashboardBootstrapOut:
    dashboard = await fetch_dashboard(db, cid, user)
    work_requests = await fetch_work_requests_page(db, cid, limit=work_request_limit, offset=0)
    workers = await fetch_workers_roster(db, cid)
    assets = await fetch_assets(db, cid)
    low_stock = await fetch_low_stock_inventory(db, cid, user)
    schedule_facilities = await fetch_schedule_facilities(db, cid)
    equipment = await fetch_beacon_equipment(db, cid)
    shifts: list = []
    if shifts_from is not None and shifts_to is not None:
        shifts = await fetch_schedule_shifts(
            db,
            cid,
            from_ts=shifts_from,
            to_ts=shifts_to,
        )
    return DashboardBootstrapOut(
        dashboard=dashboard,
        work_requests=work_requests,
        workers=workers,
        assets=assets,
        low_stock=low_stock,
        schedule_facilities=schedule_facilities,
        equipment=equipment,
        shifts=shifts,
        shifts_from=shifts_from,
        shifts_to=shifts_to,
    )
