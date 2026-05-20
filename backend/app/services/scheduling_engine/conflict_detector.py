"""Hard validation: overlaps, availability, certs, restrictions."""

from __future__ import annotations

from datetime import date

from app.services.scheduling_engine.certification_evaluator import CertificationEvaluator
from app.services.scheduling_engine.types import DraftSlot


class ConflictDetector:
    def __init__(self) -> None:
        self._certs = CertificationEvaluator()

    def blocks_assignment(
        self,
        worker: dict,
        slot: DraftSlot,
        *,
        existing_user_slots: dict[str, list[tuple[date, int, int]]],
    ) -> str | None:
        uid = str(worker.get("user_id") or worker.get("id"))
        certs = worker.get("certifications") or []
        if not self._certs.has_certifications(certs, slot.required_certs):
            return "missing required certification"
        scheduling = worker.get("scheduling") or {}
        if self._certs.shift_restriction_blocks(scheduling, slot.shift_type):
            return "shift restriction violation"

        for d, sm, em in existing_user_slots.get(uid, []):
            if d != slot.date:
                continue
            if not (slot.end_min <= sm or slot.start_min >= em):
                return "overlapping shift"
        return None
