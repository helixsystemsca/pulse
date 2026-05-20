"""
Draft scheduling orchestrator.

Generates recommended assignments only — supervisors review, lock, and publish separately.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from typing import Any

from sqlalchemy import and_, delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import User
from app.models.pulse_models import (
    EmployeeAvailability,
    PulseScheduleShift,
    PulseScheduleShiftDefinition,
    PulseWorkerProfile,
    StaffingRequirement as StaffingRequirementRow,
)
from app.services.scheduling_engine.demand_forecast import DemandForecastService
from app.services.scheduling_engine.draft_generator import DraftScheduleGenerator
from app.services.scheduling_engine.gap_detector import GapDetector
from app.services.scheduling_engine.historical_analyzer import HistoricalScheduleAnalyzer
from app.services.scheduling_engine.types import (
    DraftGenerationResult,
    GenerateDraftOptions,
    StaffingRequirement,
)

log = logging.getLogger("pulse.scheduling_engine")

_FT_TYPES = frozenset({"full_time", "regular_part_time", "ft", "full-time"})
_ABSENCE_TYPES = frozenset({"vacation", "sick", "pto", "absence"})
_ABSENCE_LABELS = frozenset({"a", "vac", "pto", "sick"})


def _band_from_shift(shift_type: str, start_min: int) -> str:
    st = (shift_type or "shift").lower()
    if st in ("day", "morning", "d1"):
        return "day"
    if st in ("afternoon", "pm", "evening"):
        return "afternoon"
    if st in ("night", "overnight", "n1", "graveyard"):
        return "night"
    if start_min < 12 * 60:
        return "day"
    if start_min < 17 * 60:
        return "afternoon"
    return "night"


def _is_absence(shift: PulseScheduleShift) -> bool:
    st = (shift.shift_type or "").lower()
    if st in _ABSENCE_TYPES:
        return True
    label = (shift.display_label or "").strip().lower()
    return label in _ABSENCE_LABELS


def _employment_type(profile: PulseWorkerProfile) -> str:
    sched = profile.scheduling or {}
    return str(sched.get("employment_type") or sched.get("employmentType") or "").lower()


def _is_ft(profile: PulseWorkerProfile) -> bool:
    et = _employment_type(profile)
    return et in _FT_TYPES or et == ""


class SchedulingEngine:
    """Orchestrates historical analysis → demand → gap fill → draft recommendations."""

    def __init__(self) -> None:
        self._historical = HistoricalScheduleAnalyzer()
        self._forecast = DemandForecastService()
        self._generator = DraftScheduleGenerator()
        self._gaps = GapDetector()

    async def generate(
        self,
        db: AsyncSession,
        company_id: str,
        options: GenerateDraftOptions,
        *,
        default_facility_id: str | None = None,
    ) -> DraftGenerationResult:
        ps = options.period_start
        pe = options.period_end
        lookback_start = ps - timedelta(days=options.historical_lookback_days)

        hist_q = await db.execute(
            select(PulseScheduleShift, PulseWorkerProfile)
            .outerjoin(PulseWorkerProfile, PulseWorkerProfile.user_id == PulseScheduleShift.assigned_user_id)
            .where(
                PulseScheduleShift.company_id == company_id,
                PulseScheduleShift.starts_at >= datetime.combine(lookback_start, time.min, tzinfo=timezone.utc),
                PulseScheduleShift.starts_at < datetime.combine(ps, time.min, tzinfo=timezone.utc),
            )
        )
        hist_rows = []
        for shift, profile in hist_q.all():
            emp = _employment_type(profile) if profile else None
            hist_rows.append(
                {
                    "starts_at": shift.starts_at,
                    "ends_at": shift.ends_at,
                    "shift_type": shift.shift_type,
                    "assigned_user_id": str(shift.assigned_user_id) if shift.assigned_user_id else None,
                    "display_label": shift.display_label,
                    "is_draft": shift.is_draft,
                    "employment_type": emp,
                }
            )

        patterns = self._historical.analyze(hist_rows, lookback_end=ps - timedelta(days=1))

        period_start_dt = datetime.combine(ps, time.min, tzinfo=timezone.utc)
        period_end_dt = datetime.combine(pe, time.max, tzinfo=timezone.utc)

        period_q = await db.execute(
            select(PulseScheduleShift).where(
                PulseScheduleShift.company_id == company_id,
                PulseScheduleShift.starts_at >= period_start_dt,
                PulseScheduleShift.starts_at <= period_end_dt,
            )
        )
        period_shifts = list(period_q.scalars().all())

        profiles_q = await db.execute(
            select(PulseWorkerProfile, User)
            .join(User, User.id == PulseWorkerProfile.user_id)
            .where(
                PulseWorkerProfile.company_id == company_id,
                User.is_active.is_(True),
            )
        )
        profile_rows = profiles_q.all()
        ft_user_ids = {str(p.user_id) for p, _ in profile_rows if _is_ft(p)}

        ft_absences: dict[date, int] = defaultdict(int)
        for shift in period_shifts:
            if _is_absence(shift) and str(shift.assigned_user_id) in ft_user_ids:
                ft_absences[shift.starts_at.date()] += 1

        requirements = self._forecast.forecast(
            period_start=ps,
            period_end=pe,
            patterns=patterns,
            ft_absence_counts=dict(ft_absences),
            zone_id=default_facility_id,
        )

        if options.regenerate_dates:
            allowed = set(options.regenerate_dates)
            requirements = [r for r in requirements if r.date in allowed]

        avail_q = await db.execute(
            select(EmployeeAvailability).where(
                EmployeeAvailability.company_id == company_id,
                EmployeeAvailability.date >= ps,
                EmployeeAvailability.date <= pe,
            )
        )
        availability_by_employee: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for row in avail_q.scalars().all():
            availability_by_employee[str(row.employee_id)].append(
                {
                    "employee_id": str(row.employee_id),
                    "date": row.date.isoformat(),
                    "status": row.status,
                    "restriction_type": row.restriction_type,
                }
            )

        workers: list[dict[str, Any]] = []
        for profile, user in profile_rows:
            sched = profile.scheduling or {}
            workers.append(
                {
                    "user_id": str(profile.user_id),
                    "name": user.full_name or user.email,
                    "certifications": profile.certifications or [],
                    "employment_type": _employment_type(profile),
                    "scheduling": sched,
                    "availability": profile.availability or {},
                }
            )

        covered_existing: dict[tuple[str, str], int] = defaultdict(int)
        existing_user_slots: dict[str, list[tuple[date, int, int]]] = defaultdict(list)
        hours_assigned: dict[str, float] = defaultdict(float)
        assigned_by_user_date: dict[tuple[str, date], list[str]] = defaultdict(list)

        for shift in period_shifts:
            if _is_absence(shift):
                continue
            if options.respect_locked and getattr(shift, "locked", False):
                sm = shift.starts_at.hour * 60 + shift.starts_at.minute
                em = shift.ends_at.hour * 60 + shift.ends_at.minute
                existing_user_slots[str(shift.assigned_user_id)].append(
                    (shift.starts_at.date(), sm, em)
                )
                band = _band_from_shift(shift.shift_type, sm)
                key = (shift.starts_at.date().isoformat(), band)
                covered_existing[key] += 1
                continue
            if shift.is_draft and options.respect_locked:
                continue
            sm = shift.starts_at.hour * 60 + shift.starts_at.minute
            em = shift.ends_at.hour * 60 + shift.ends_at.minute
            d = shift.starts_at.date()
            band = _band_from_shift(shift.shift_type, sm)
            key = (d.isoformat(), band)
            covered_existing[key] += 1
            uid = str(shift.assigned_user_id)
            existing_user_slots[uid].append((d, sm, em))
            assigned_by_user_date[(uid, d)].append(band)
            hours_assigned[uid] += (shift.ends_at - shift.starts_at).total_seconds() / 3600

        slots_to_fill = []
        for req in requirements:
            key = (req.date.isoformat(), req.shift_type)
            covered = covered_existing.get(key, 0)
            gap = max(0, req.required_count - covered)
            for _ in range(gap):
                slots_to_fill.append(
                    self._generator.slot_for_band(
                        req.date,
                        req.shift_type,
                        required_certs=req.required_certifications,
                        facility_id=req.zone_id or default_facility_id,
                        staffing_requirement_id=req.id,
                    )
                )

        assignments, conflicts = self._generator.fill_slots(
            slots_to_fill,
            workers,
            patterns=patterns,
            hours_assigned=dict(hours_assigned),
            fairness_enabled=options.fairness_enabled,
            max_hours=options.max_hours_per_worker,
            existing_user_slots=dict(existing_user_slots),
            assigned_by_user_date=assigned_by_user_date,
            availability_by_employee=dict(availability_by_employee),
        )

        gaps = self._gaps.detect(requirements, assignments, conflicts, covered_by_existing=covered_existing)

        await self._persist_requirements(db, company_id, requirements)

        patterns_summary = {
            "sample_days": patterns.sample_days,
            "auxiliary_share": round(patterns.auxiliary_share, 3),
            "overnight_share": round(patterns.overnight_share, 3),
            "avg_weekday_staff": {str(k): round(v, 2) for k, v in patterns.avg_staff_by_weekday.items()},
            "avg_by_band": {k: round(v, 2) for k, v in patterns.avg_staff_by_shift_type.items()},
        }

        log.info(
            "draft_generated company=%s slots=%d assigned=%d gaps=%d",
            company_id[:8],
            len(slots_to_fill),
            len(assignments),
            len(gaps),
        )

        return DraftGenerationResult(
            assignments=assignments,
            conflicts=conflicts,
            gaps=gaps,
            staffing_requirements=requirements,
            total_slots=len(slots_to_fill),
            patterns_summary=patterns_summary,
        )

    async def _persist_requirements(
        self,
        db: AsyncSession,
        company_id: str,
        requirements: list[StaffingRequirement],
    ) -> None:
        if not requirements:
            return
        dates = {r.date for r in requirements}
        await db.execute(
            delete(StaffingRequirementRow).where(
                and_(
                    StaffingRequirementRow.company_id == company_id,
                    StaffingRequirementRow.date.in_(list(dates)),
                )
            )
        )
        for req in requirements:
            db.add(
                StaffingRequirementRow(
                    id=req.id,
                    company_id=company_id,
                    date=req.date,
                    shift_type=req.shift_type,
                    required_count=req.required_count,
                    required_certifications=req.required_certifications,
                    zone_id=req.zone_id,
                    event_id=req.event_id,
                    source=req.source,
                    confidence_score=req.confidence_score,
                )
            )
