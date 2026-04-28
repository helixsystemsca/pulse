"""
Schedule draft auto-populate engine.
Scores and assigns auxiliary workers to open shift slots.
Reads availability in both v1 and v2 formats (matches service.py behavior).
Called by POST /api/v1/pulse/schedule/draft.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import User
from app.models.pulse_models import PulseScheduleShift, PulseWorkerProfile

log = logging.getLogger("pulse.schedule.draft")

WEEKDAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


@dataclass
class DraftSlot:
    date: date
    start_min: int  # minutes from midnight
    end_min: int
    shift_type: str
    shift_definition_id: str | None = None
    shift_code: str | None = None
    required_certs: list[str] = field(default_factory=list)
    facility_id: str | None = None


@dataclass
class DraftAssignment:
    slot: DraftSlot
    user_id: str
    user_name: str
    score: float
    warnings: list[str] = field(default_factory=list)


@dataclass
class DraftConflict:
    slot: DraftSlot
    reason: str


@dataclass
class DraftResult:
    assignments: list[DraftAssignment]
    conflicts: list[DraftConflict]
    total_slots: int


def _parse_availability_v2(av: dict[str, Any], weekday: int) -> tuple[int, int] | None:
    """v2: {monday: [{start: 480, end: 1020}], ...}"""
    key = WEEKDAY_KEYS[weekday]
    windows = av.get(key)
    if not windows or not isinstance(windows, list):
        return None
    for w in windows:
        if isinstance(w, dict):
            s = w.get("start")
            e = w.get("end")
            if s is not None and e is not None:
                return (int(s), int(e))
    return None


def _parse_availability_v1(av: dict[str, Any], weekday: int) -> tuple[int, int] | None:
    """v1: {windows: [{weekday: 0, start_min: 480, end_min: 1020}]}"""
    windows = av.get("windows")
    if not windows or not isinstance(windows, list):
        return None
    for w in windows:
        if not isinstance(w, dict):
            continue
        if int(w.get("weekday", -1)) == weekday:
            sm = w.get("start_min")
            em = w.get("end_min")
            if sm is not None and em is not None:
                return (int(sm), int(em))
    return None


def _worker_available_for_slot(av: dict[str, Any], slot: DraftSlot) -> bool:
    weekday = slot.date.weekday()  # 0=Monday
    window = _parse_availability_v2(av, weekday) or _parse_availability_v1(av, weekday)
    if not window:
        return False
    sm, em = window
    # Worker window must cover at least the start of the slot
    return sm <= slot.start_min < em


def _worker_has_certs(worker_certs: list[str], required: list[str]) -> bool:
    if not required:
        return True
    wc = set(c.lower() for c in worker_certs)
    return all(c.lower() in wc for c in required)


def _period_shift_hours(
    all_shifts: list[PulseScheduleShift],
    user_id: str,
    period_start: date,
    period_end: date,
) -> float:
    total = 0.0
    for s in all_shifts:
        if str(s.assigned_user_id) != user_id:
            continue
        if not (period_start <= s.starts_at.date() <= period_end):
            continue
        total += (s.ends_at - s.starts_at).total_seconds() / 3600
    return total


def _slot_hours(slot: DraftSlot) -> float:
    mins = slot.end_min - slot.start_min
    if mins < 0:
        mins += 24 * 60
    return mins / 60


def _already_assigned(
    assignments: list[DraftAssignment],
    user_id: str,
    slot: DraftSlot,
) -> bool:
    for a in assignments:
        if a.user_id == user_id and a.slot.date == slot.date:
            return True
    return False


def _score_worker(
    profile: PulseWorkerProfile,
    slot: DraftSlot,
    all_shifts: list[PulseScheduleShift],
    period_start: date,
    period_end: date,
    max_hours: float,
    fairness_enabled: bool,
) -> tuple[float, list[str]]:
    """Score 0–100+. Returns -1 if hard-blocked."""
    score = 100.0
    warnings: list[str] = []
    av = profile.availability or {}

    if not _worker_available_for_slot(av, slot):
        return -1.0, ["Not available"]

    period_hours = _period_shift_hours(all_shifts, str(profile.user_id), period_start, period_end)
    slot_h = _slot_hours(slot)

    if period_hours + slot_h > max_hours:
        warnings.append(f"Would exceed {max_hours}h period limit")
        score -= 30

    if fairness_enabled:
        # Fewer shifts this period = higher score
        period_count = sum(
            1
            for s in all_shifts
            if str(s.assigned_user_id) == str(profile.user_id)
            and period_start <= s.starts_at.date() <= period_end
        )
        score -= period_count * 5

    scheduling = profile.scheduling or {}
    if scheduling.get("employment_type") == "full_time":
        score += 10

    return score, warnings


async def build_draft(
    db: AsyncSession,
    company_id: str,
    slots: list[DraftSlot],
    period_start: date,
    period_end: date,
    max_hours_per_worker: float = 160,
    fairness_enabled: bool = True,
) -> DraftResult:
    q = await db.execute(
        select(PulseWorkerProfile, User)
        .join(User, User.id == PulseWorkerProfile.user_id)
        .where(
            PulseWorkerProfile.company_id == company_id,
            User.is_active.is_(True),
        )
    )
    profile_rows = q.all()

    period_start_dt = datetime.combine(period_start, datetime.min.time(), tzinfo=timezone.utc)
    period_end_dt = datetime.combine(period_end, datetime.max.time(), tzinfo=timezone.utc)

    existing_q = await db.execute(
        select(PulseScheduleShift).where(
            PulseScheduleShift.company_id == company_id,
            PulseScheduleShift.starts_at >= period_start_dt,
            PulseScheduleShift.ends_at <= period_end_dt,
        )
    )
    existing_shifts = list(existing_q.scalars().all())

    assignments: list[DraftAssignment] = []
    conflicts: list[DraftConflict] = []

    for slot in slots:
        slot_dt = datetime.combine(
            slot.date,
            time(hour=slot.start_min // 60, minute=slot.start_min % 60),
            tzinfo=timezone.utc,
        )
        # Skip if full-time shift already covers this slot
        already_filled = any(
            abs((s.starts_at - slot_dt).total_seconds()) < 300
            for s in existing_shifts
        )
        if already_filled:
            continue

        best_score = -1.0
        best_profile: PulseWorkerProfile | None = None
        best_user: User | None = None
        best_warnings: list[str] = []

        for profile, user in profile_rows:
            certs = profile.certifications or []
            if not _worker_has_certs(certs, slot.required_certs):
                continue
            if _already_assigned(assignments, str(profile.user_id), slot):
                continue

            score, warnings = _score_worker(
                profile,
                slot,
                existing_shifts,
                period_start,
                period_end,
                max_hours_per_worker,
                fairness_enabled,
            )

            if score > best_score:
                best_score = score
                best_profile = profile
                best_user = user
                best_warnings = warnings

        if best_profile and best_user and best_score >= 0:
            assignments.append(
                DraftAssignment(
                    slot=slot,
                    user_id=str(best_profile.user_id),
                    user_name=best_user.full_name or best_user.email,
                    score=best_score,
                    warnings=best_warnings,
                )
            )
        else:
            reason = "No eligible worker available"
            if slot.required_certs:
                reason = f"No worker with required certs: {', '.join(slot.required_certs)}"
            conflicts.append(DraftConflict(slot=slot, reason=reason))

    log.info(
        "draft company=%s slots=%d assigned=%d conflicts=%d",
        company_id[:8],
        len(slots),
        len(assignments),
        len(conflicts),
    )
    return DraftResult(
        assignments=assignments,
        conflicts=conflicts,
        total_slots=len(slots),
    )
