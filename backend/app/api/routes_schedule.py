"""
Schedule API surface (Xplor Recreation integration).

Endpoints:
- GET /api/schedule
- GET /api/schedule/live (reserved for future WS / SSE)
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Query

from app.models.schedule import ScheduleEvent, transform_xplor_schedule
from app.services.xplor_client import XplorClient

router = APIRouter(tags=["schedule"])


@router.get("/schedule", response_model=list[ScheduleEvent])
async def get_schedule(
    facility_id: Optional[str] = Query(default=None),
    date: Optional[str] = Query(default=None, description="YYYY-MM-DD (optional)"),
) -> List[ScheduleEvent]:
    """
    Get normalized facility schedules.

    Behavior:
    - Uses in-memory cache inside the Xplor client for 30–60s (configurable)
    - If upstream fails, returns cached data
    - If no cache, returns mock data (or empty list if transform yields none)
    """
    client = XplorClient()
    raw = await client.get_schedules_with_fallback(facility_id=facility_id, date=date)
    return transform_xplor_schedule(raw)


@router.get("/schedule/live")
async def get_schedule_live() -> dict:
    """
    Reserved for future real-time support (WebSocket/SSE).
    """
    return {"ok": True, "ts": datetime.utcnow().isoformat() + "Z", "message": "Not implemented yet."}

