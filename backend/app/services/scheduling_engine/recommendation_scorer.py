"""Weighted soft scoring for eligible candidates."""

from __future__ import annotations

from datetime import date

from app.services.scheduling_engine.availability_evaluator import AvailabilityEvaluator
from app.services.scheduling_engine.certification_evaluator import CertificationEvaluator
from app.services.scheduling_engine.fairness_evaluator import FairnessEvaluator
from app.services.scheduling_engine.fatigue_evaluator import FatigueEvaluator
from app.services.scheduling_engine.tendency_learner import TendencyLearner
from app.services.scheduling_engine.types import DraftSlot, HistoricalPatterns


class RecommendationScorer:
    def __init__(self) -> None:
        self._avail = AvailabilityEvaluator()
        self._certs = CertificationEvaluator()
        self._fatigue = FatigueEvaluator()
        self._fairness = FairnessEvaluator()
        self._tendency = TendencyLearner()

    def score_candidate(
        self,
        worker: dict,
        slot: DraftSlot,
        *,
        patterns: HistoricalPatterns,
        hours_assigned: dict[str, float],
        fairness_enabled: bool,
        assigned_by_user_date: dict[tuple[str, date], list[str]],
        availability_rows: list[dict] | None = None,
    ) -> tuple[float, float, str]:
        uid = str(worker.get("user_id") or worker.get("id"))
        reasons: list[str] = []

        ok, avail_pts, avail_reasons = self._avail.is_available(
            worker, slot.date, availability_rows=availability_rows
        )
        if not ok:
            return 0.0, 0.0, "unavailable"
        reasons.extend(avail_reasons)

        cert_pts, cert_reasons = self._certs.cert_match_score(
            worker.get("certifications") or [], slot.required_certs
        )
        reasons.extend(cert_reasons)

        tend_pts, tend_reasons = self._tendency.score_tendency(
            uid, slot_date=slot.date, shift_band=slot.shift_type, patterns=patterns
        )
        reasons.extend(tend_reasons)

        fair_pts, fair_reasons = self._fairness.fairness_bonus(
            uid, hours_assigned, enabled=fairness_enabled
        )
        reasons.extend(fair_reasons)

        fatigue_pen, fatigue_notes = self._fatigue.fatigue_penalty(
            uid,
            slot.date,
            slot.shift_type,
            assigned_by_user_date=assigned_by_user_date,
        )
        reasons.extend(fatigue_notes)

        total = avail_pts + cert_pts + tend_pts + fair_pts - fatigue_pen
        if (worker.get("employment_type") or "").lower() in ("auxiliary", "aux", "casual"):
            total += 5.0
            reasons.append("auxiliary pool")

        confidence = min(0.95, max(0.35, 0.4 + total / 120.0))
        reason_text = "Recommended because: " + "; ".join(reasons[:6]) if reasons else "Eligible match"
        return total, confidence, reason_text
