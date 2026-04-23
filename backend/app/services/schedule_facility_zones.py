"""
Schedule "facilities" for workforce planning, stored as `zones` rows with
`meta.schedule_facility` + `meta.slot_index` so shift `zone_id` still satisfies
the existing FK. Equipment and drawings continue to use other zone rows
(without this marker).
"""
from __future__ import annotations

from typing import Any, Optional
from uuid import uuid4

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.org_module_settings_merge import DEFAULT_ORG_MODULE_SETTINGS, merge_org_module_settings
from app.models.domain import Zone
from app.models.pulse_models import PulseOrgModuleSettings, PulseScheduleShift


def schedule_facility_plan_from_merged(merged: dict[str, Any]) -> tuple[int, list[str]]:
    sched: dict[str, Any] = merged.get("schedule") or {}
    sched_defaults = (DEFAULT_ORG_MODULE_SETTINGS.get("schedule") or {})  # type: ignore[union-attr]
    raw = sched.get("facilityCount", sched_defaults.get("facilityCount", 3))
    try:
        count = int(raw)
    except (TypeError, ValueError):
        count = 3
    count = max(1, min(count, 20))

    fl = sched.get("facilityLabels")
    labels: list[str] = []
    if isinstance(fl, list):
        for x in fl:
            if x is None:
                continue
            s = str(x).strip()
            if s:
                labels.append(s[:255])
    names: list[str] = []
    for i in range(count):
        if i < len(labels) and labels[i]:
            names.append(labels[i])
        else:
            names.append(f"Facility {i + 1}")
    return count, names


async def sync_schedule_facility_zones(
    db: AsyncSession,
    company_id: str,
    count: int,
    names: list[str],
) -> None:
    if len(names) != count:
        raise ValueError("names length must match count")
    if count < 1 or count > 20:
        raise ValueError("count out of range")

    q = await db.execute(select(Zone).where(Zone.company_id == company_id))
    all_company_z = q.scalars().all()
    sf: list[Zone] = [z for z in all_company_z if (z.meta or {}).get("schedule_facility") is True]

    by_slot: dict[int, Zone] = {}
    for z in sf:
        slot = (z.meta or {}).get("slot_index")
        if isinstance(slot, int) and 0 <= slot < 20:
            by_slot[slot] = z

    for i, name in enumerate(names):
        if i in by_slot:
            z = by_slot[i]
            z.name = name
            m = dict(z.meta or {})
            m["schedule_facility"] = True
            m["slot_index"] = i
            z.meta = m
        else:
            z = Zone(
                id=str(uuid4()),
                company_id=company_id,
                name=name,
                meta={"schedule_facility": True, "slot_index": i},
            )
            db.add(z)
            await db.flush()
            by_slot[i] = z

    await db.flush()
    # refresh kept zone ids
    first_id: Optional[str] = by_slot[0].id if 0 in by_slot else None
    keep_ids: set[str] = {by_slot[i].id for i in range(count) if i in by_slot}

    q2 = await db.execute(select(Zone).where(Zone.company_id == company_id))
    allz = q2.scalars().all()
    to_remove = [
        z
        for z in allz
        if (z.meta or {}).get("schedule_facility") is True
        and z.id not in keep_ids
    ]

    for z in to_remove:
        rid = str(z.id)
        target = first_id
        await db.execute(
            update(PulseScheduleShift)
            .where(PulseScheduleShift.zone_id == rid)
            .values(zone_id=target)
        )
        await db.delete(z)

    await db.flush()


async def ensure_schedule_facility_zones(
    db: AsyncSession,
    company_id: str,
) -> list[Zone]:
    """
    If the tenant has no schedule-facility zones yet, create them from merged org settings
    and return all schedule-facility rows (ordered by slot_index).
    """
    q = await db.execute(select(Zone).where(Zone.company_id == company_id))
    allz = q.scalars().all()
    sf = [z for z in allz if (z.meta or {}).get("schedule_facility") is True]
    if sf:
        return sorted(sf, key=lambda z: int((z.meta or {}).get("slot_index", 999)))

    row = await db.execute(select(PulseOrgModuleSettings).where(PulseOrgModuleSettings.company_id == company_id))
    pms = row.scalar_one_or_none()
    merged = merge_org_module_settings(pms.settings if pms else None)
    count, names = schedule_facility_plan_from_merged(merged)
    await sync_schedule_facility_zones(db, company_id, count, names)
    await db.flush()

    q2 = await db.execute(select(Zone).where(Zone.company_id == company_id))
    all2 = q2.scalars().all()
    out = [z for z in all2 if (z.meta or {}).get("schedule_facility") is True]
    return sorted(out, key=lambda z: int((z.meta or {}).get("slot_index", 999)))
