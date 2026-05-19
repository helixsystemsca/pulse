"""Fill uncovered slots using scored auxiliary candidates."""

from __future__ import annotations

from datetime import date

from app.services.scheduling_engine.conflict_detector import ConflictDetector
from app.services.scheduling_engine.recommendation_scorer import RecommendationScorer
from app.services.scheduling_engine.types import (
    DraftAssignment,
    DraftConflict,
    DraftSlot,
    HistoricalPatterns,
)


BAND_WINDOWS: dict[str, tuple[int, int]] = {
    "day": (7 * 60, 15 * 60),
    "afternoon": (15 * 60, 23 * 60),
    "night": (23 * 60, 7 * 60),
}


class DraftScheduleGenerator:
    def __init__(self) -> None:
        self._conflicts = ConflictDetector()
        self._scorer = RecommendationScorer()

    def slot_for_band(
        self,
        d: date,
        band: str,
        *,
        required_certs: list[str],
        facility_id: str | None,
        staffing_requirement_id: str | None = None,
        shift_definition_id: str | None = None,
        shift_code: str | None = None,
    ) -> DraftSlot:
        start_min, end_min = BAND_WINDOWS.get(band, BAND_WINDOWS["day"])
        return DraftSlot(
            date=d,
            start_min=start_min,
            end_min=end_min,
            shift_type=band,
            required_certs=list(required_certs),
            facility_id=facility_id,
            staffing_requirement_id=staffing_requirement_id,
            shift_definition_id=shift_definition_id,
            shift_code=shift_code,
        )

    def fill_slots(
        self,
        slots: list[DraftSlot],
        workers: list[dict],
        *,
        patterns: HistoricalPatterns,
        hours_assigned: dict[str, float],
        fairness_enabled: bool,
        max_hours: float,
        existing_user_slots: dict[str, list[tuple[date, int, int]]],
        assigned_by_user_date: dict[tuple[str, date], list[str]],
        availability_by_employee: dict[str, list[dict]],
    ) -> tuple[list[DraftAssignment], list[DraftConflict]]:
        assignments: list[DraftAssignment] = []
        conflicts: list[DraftConflict] = []

        for slot in slots:
            best_score = -1.0
            best_worker: dict | None = None
            best_conf = 0.0
            best_reason = ""
            best_warnings: list[str] = []

            for worker in workers:
                uid = str(worker.get("user_id") or worker.get("id"))
                block = self._conflicts.blocks_assignment(
                    worker, slot, existing_user_slots=existing_user_slots
                )
                if block:
                    continue
                if any(a.user_id == uid and a.slot.date == slot.date for a in assignments):
                    continue

                score, conf, reason = self._scorer.score_candidate(
                    worker,
                    slot,
                    patterns=patterns,
                    hours_assigned=hours_assigned,
                    fairness_enabled=fairness_enabled,
                    assigned_by_user_date=assigned_by_user_date,
                    availability_rows=availability_by_employee.get(uid),
                )
                if score <= 0:
                    continue

                slot_h = max((slot.end_min - slot.start_min) % (24 * 60), 60) / 60.0
                if hours_assigned.get(uid, 0) + slot_h > max_hours:
                    score -= 20
                    best_warnings = [f"Would exceed {max_hours}h period cap"]

                if score > best_score:
                    best_score = score
                    best_worker = worker
                    best_conf = conf
                    best_reason = reason

            if best_worker and best_score > 0:
                uid = str(best_worker["user_id"])
                assignments.append(
                    DraftAssignment(
                        slot=slot,
                        user_id=uid,
                        user_name=best_worker.get("name") or uid,
                        score=best_score,
                        confidence_score=best_conf,
                        recommendation_reason=best_reason,
                        warnings=best_warnings,
                    )
                )
                existing_user_slots.setdefault(uid, []).append(
                    (slot.date, slot.start_min, slot.end_min)
                )
                assigned_by_user_date.setdefault((uid, slot.date), []).append(slot.shift_type)
                slot_h = max((slot.end_min - slot.start_min) % (24 * 60), 60) / 60.0
                hours_assigned[uid] = hours_assigned.get(uid, 0.0) + slot_h
            else:
                reason = "No eligible worker available"
                if slot.required_certs:
                    reason = f"No worker with required certs: {', '.join(slot.required_certs)}"
                conflicts.append(DraftConflict(slot=slot, reason=reason))

        return assignments, conflicts
