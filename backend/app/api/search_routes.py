"""
GET /api/v1/search?q=<query>
Unified search across tools (BLE devices), equipment, procedures, and work requests.
Returns typed result buckets. Max 5 results per bucket.
"""

from __future__ import annotations

import logging
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.device_hub import AutomationBleDevice, BeaconPosition
from app.models.domain import FacilityEquipment, User, Zone
from app.models.pulse_models import PulseProcedure, PulseWorkRequest

log = logging.getLogger("pulse.search")
router = APIRouter(prefix="/search", tags=["search"])


class SearchResultItem(BaseModel):
    id: str
    kind: str  # "tool" | "equipment" | "procedure" | "work_request"
    title: str
    subtitle: str | None = None
    meta: dict[str, Any] = {}


class SearchResults(BaseModel):
    query: str
    tools: list[SearchResultItem] = []
    equipment: list[SearchResultItem] = []
    procedures: list[SearchResultItem] = []
    work_requests: list[SearchResultItem] = []
    total: int = 0


def _wr_status(wr: PulseWorkRequest) -> str:
    st = wr.status
    return st.value if hasattr(st, "value") else str(st)


def _wr_priority(wr: PulseWorkRequest) -> str:
    pr = wr.priority
    return pr.value if hasattr(pr, "value") else str(pr)


@router.get("", response_model=SearchResults)
async def unified_search(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    q: str = Query("", min_length=0, max_length=100),
) -> SearchResults:
    if user.company_id is None:
        return SearchResults(query=q)

    cid = str(user.company_id)
    term = q.strip().lower()

    if not term:
        return SearchResults(query=q)

    like = f"%{term}%"
    results = SearchResults(query=q)

    try:
        tool_q = await db.execute(
            select(AutomationBleDevice, BeaconPosition)
            .outerjoin(BeaconPosition, BeaconPosition.beacon_id == AutomationBleDevice.id)
            .outerjoin(Zone, Zone.id == BeaconPosition.zone_id)
            .where(
                AutomationBleDevice.company_id == cid,
                or_(AutomationBleDevice.name.ilike(like), AutomationBleDevice.mac_address.ilike(like)),
            )
            .limit(5)
        )
        for device, pos, zone in tool_q.all():
            subtitle = (
                f"Last seen: {pos.computed_at.strftime('%b %d %H:%M')}"
                if pos is not None
                else "Unknown"
            )
            results.tools.append(
                SearchResultItem(
                    id=str(device.id),
                    kind="tool",
                    title=device.name or device.mac_address,
                    subtitle=subtitle,
                    meta={
                        "mac_address": device.mac_address,
                        "type": device.type,
                        "zone_id": str(pos.zone_id) if pos is not None and pos.zone_id else None,
                        "zone_name": str(zone.name) if zone is not None and getattr(zone, "name", None) else None,
                        "last_seen_at": pos.computed_at.isoformat() if pos is not None and pos.computed_at else None,
                        "x_norm": float(pos.x_norm) if pos is not None and pos.x_norm is not None else None,
                        "y_norm": float(pos.y_norm) if pos is not None and pos.y_norm is not None else None,
                    },
                )
            )
    except Exception as e:
        log.warning("search tools failed: %s", e)

    try:
        equip_q = await db.execute(
            select(FacilityEquipment)
            .where(
                FacilityEquipment.company_id == cid,
                or_(FacilityEquipment.name.ilike(like), FacilityEquipment.type.ilike(like)),
            )
            .limit(5)
        )
        for eq in equip_q.scalars():
            results.equipment.append(
                SearchResultItem(
                    id=str(eq.id),
                    kind="equipment",
                    title=eq.name,
                    subtitle=eq.type or None,
                    meta={"zone_id": str(eq.zone_id) if eq.zone_id else None},
                )
            )
    except Exception as e:
        log.warning("search equipment failed: %s", e)

    try:
        wr_q = await db.execute(
            select(PulseWorkRequest).where(
                PulseWorkRequest.company_id == cid,
                PulseWorkRequest.title.ilike(like),
            ).limit(5)
        )
        for wr in wr_q.scalars():
            results.work_requests.append(
                SearchResultItem(
                    id=str(wr.id),
                    kind="work_request",
                    title=wr.title,
                    subtitle=_wr_status(wr),
                    meta={"priority": _wr_priority(wr), "status": _wr_status(wr)},
                )
            )
    except Exception as e:
        log.warning("search work_requests failed: %s", e)

    try:
        proc_q = await db.execute(
            select(PulseProcedure).where(
                PulseProcedure.company_id == cid,
                PulseProcedure.title.ilike(like),
            ).limit(5)
        )
        for proc in proc_q.scalars():
            results.procedures.append(
                SearchResultItem(
                    id=str(proc.id),
                    kind="procedure",
                    title=proc.title,
                    subtitle=None,
                    meta={},
                )
            )
    except Exception as e:
        log.warning("search procedures failed: %s", e)

    results.total = (
        len(results.tools)
        + len(results.equipment)
        + len(results.procedures)
        + len(results.work_requests)
    )

    log.info("search q=%r company=%s total=%d", term, cid[:8], results.total)
    return results
