"""Pulse business logic: scheduling rules, work requests, inventory hints."""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.domain import EquipmentPart, InventoryItem, Tool, ToolStatus, User, UserRole, Zone
from app.models.pulse_models import (
    PulseBeaconEquipment,
    PulseScheduleShift,
    PulseWorkRequest,
    PulseWorkRequestStatus,
    PulseWorkerProfile,
)


def _weekday_and_minutes_utc(dt: datetime) -> tuple[int, int]:
    d = dt.astimezone(timezone.utc)
    wd = d.weekday()
    minutes = d.hour * 60 + d.minute
    return wd, minutes


def _availability_warnings(
    availability: dict[str, Any],
    starts_at: datetime,
    ends_at: datetime,
) -> list[str]:
    warnings: list[str] = []
    windows = availability.get("windows") if isinstance(availability, dict) else None
    if not windows or not isinstance(windows, list):
        return warnings
    start_wd, start_min = _weekday_and_minutes_utc(starts_at)
    ok = False
    for w in windows:
        if not isinstance(w, dict):
            continue
        try:
            wd = int(w.get("weekday", -1))
            sm = int(w.get("start_min", -1))
            em = int(w.get("end_min", -1))
        except (TypeError, ValueError):
            continue
        if wd != start_wd:
            continue
        if sm <= start_min < em:
            ok = True
            break
    if not ok and windows:
        warnings.append("Shift start is outside this worker's saved availability windows (UTC).")
    return warnings


def _cert_has_ticketed(certs: list[str]) -> bool:
    return any("ticketed" in str(c).lower() for c in certs)


async def _user_in_company(db: AsyncSession, company_id: str, user_id: str) -> Optional[User]:
    q = await db.execute(
        select(User).where(
            User.id == user_id,
            User.company_id == company_id,
            User.is_active.is_(True),
        )
    )
    return q.scalar_one_or_none()


async def tool_in_company(db: AsyncSession, company_id: str, tool_id: str) -> bool:
    q = await db.execute(select(Tool.id).where(Tool.id == tool_id, Tool.company_id == company_id))
    return q.scalar_one_or_none() is not None


async def facility_equipment_in_company(db: AsyncSession, company_id: str, equipment_id: str) -> bool:
    from app.models.domain import FacilityEquipment

    q = await db.execute(
        select(FacilityEquipment.id).where(
            FacilityEquipment.id == equipment_id,
            FacilityEquipment.company_id == company_id,
        )
    )
    return q.scalar_one_or_none() is not None


async def equipment_part_for_company(
    db: AsyncSession, company_id: str, part_id: str
) -> Optional[EquipmentPart]:
    q = await db.execute(
        select(EquipmentPart).where(
            EquipmentPart.id == part_id,
            EquipmentPart.company_id == company_id,
        )
    )
    return q.scalar_one_or_none()


async def zone_in_company(db: AsyncSession, company_id: str, zone_id: str) -> bool:
    q = await db.execute(select(Zone.id).where(Zone.id == zone_id, Zone.company_id == company_id))
    return q.scalar_one_or_none() is not None


async def _shift_overlap_exists(
    db: AsyncSession,
    company_id: str,
    user_id: str,
    starts_at: datetime,
    ends_at: datetime,
    exclude_shift_id: Optional[str] = None,
) -> bool:
    cond = and_(
        PulseScheduleShift.company_id == company_id,
        PulseScheduleShift.assigned_user_id == user_id,
        PulseScheduleShift.starts_at < ends_at,
        PulseScheduleShift.ends_at > starts_at,
    )
    stmt = select(PulseScheduleShift.id).where(cond)
    if exclude_shift_id:
        stmt = stmt.where(PulseScheduleShift.id != exclude_shift_id)
    q = await db.execute(stmt.limit(1))
    return q.scalar_one_or_none() is not None


async def validate_shift_assignment(
    db: AsyncSession,
    company_id: str,
    body_starts: datetime,
    body_ends: datetime,
    assigned_user_id: str,
    requires_supervisor: bool,
    requires_ticketed: bool,
    exclude_shift_id: Optional[str] = None,
) -> tuple[list[str], list[str]]:
    """
    Returns (errors, warnings). Errors block creation; warnings are returned to the client.
    """
    errors: list[str] = []
    warnings: list[str] = []

    if body_starts >= body_ends:
        errors.append("Shift start must be before end time.")
        return errors, warnings

    user = await _user_in_company(db, company_id, assigned_user_id)
    if not user:
        errors.append("Assigned user not found in this organization.")
        return errors, warnings

    if await _shift_overlap_exists(
        db, company_id, assigned_user_id, body_starts, body_ends, exclude_shift_id
    ):
        errors.append("This worker already has a shift that overlaps this interval.")

    if requires_supervisor and user.role not in (UserRole.manager, UserRole.company_admin):
        errors.append("This shift requires a supervisor (manager or company admin).")

    prof_q = await db.execute(
        select(PulseWorkerProfile).where(
            PulseWorkerProfile.user_id == assigned_user_id,
            PulseWorkerProfile.company_id == company_id,
        )
    )
    prof = prof_q.scalar_one_or_none()
    certs: list[str] = list(prof.certifications or []) if prof else []
    if requires_ticketed and not _cert_has_ticketed(certs):
        errors.append("This shift requires a ticketed worker (add 'ticketed' to certifications).")

    avail: dict[str, Any] = dict(prof.availability or {}) if prof else {}
    warnings.extend(_availability_warnings(avail, body_starts, body_ends))

    return errors, warnings


async def dashboard_aggregate(db: AsyncSession, company_id: str) -> dict[str, Any]:
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today_start + timedelta(days=1)

    active_workers_q = await db.execute(
        select(func.count())
        .select_from(User)
        .where(
            User.company_id == company_id,
            User.is_active.is_(True),
            User.role.in_((UserRole.worker, UserRole.manager)),
        )
    )
    active_workers = int(active_workers_q.scalar_one() or 0)

    open_wr_q = await db.execute(
        select(func.count())
        .select_from(PulseWorkRequest)
        .where(
            PulseWorkRequest.company_id == company_id,
            PulseWorkRequest.status.in_((PulseWorkRequestStatus.open, PulseWorkRequestStatus.in_progress)),
        )
    )
    open_wr = int(open_wr_q.scalar_one() or 0)

    low_stock_q = await db.execute(
        select(func.count())
        .select_from(InventoryItem)
        .where(
            InventoryItem.company_id == company_id,
            InventoryItem.quantity <= InventoryItem.low_stock_threshold,
        )
    )
    low_stock = int(low_stock_q.scalar_one() or 0)

    shifts_today_q = await db.execute(
        select(func.count())
        .select_from(PulseScheduleShift)
        .where(
            PulseScheduleShift.company_id == company_id,
            PulseScheduleShift.starts_at < tomorrow,
            PulseScheduleShift.ends_at > today_start,
        )
    )
    shifts_today = int(shifts_today_q.scalar_one() or 0)

    alerts: list[str] = []
    if low_stock:
        alerts.append(f"{low_stock} inventory item(s) at or below low-stock threshold.")
    if open_wr:
        alerts.append(f"{open_wr} open or in-progress work request(s).")

    return {
        "active_workers": active_workers,
        "open_work_requests": open_wr,
        "low_stock_items": low_stock,
        "shifts_today": shifts_today,
        "alerts": alerts,
    }


def safe_photo_filename(name: str) -> str:
    base = Path(name).name
    base = re.sub(r"[^a-zA-Z0-9._-]", "_", base)[:180]
    return base or "upload.bin"


async def save_beacon_photo(
    company_id: str,
    equipment_id: str,
    filename: str,
    content: bytes,
) -> str:
    settings = get_settings()
    root = Path(settings.pulse_uploads_dir)
    dest_dir = root / company_id / "beacons"
    dest_dir.mkdir(parents=True, exist_ok=True)
    safe = safe_photo_filename(filename)
    dest = dest_dir / f"{equipment_id}_{safe}"
    dest.write_bytes(content)
    return str(dest.as_posix())
