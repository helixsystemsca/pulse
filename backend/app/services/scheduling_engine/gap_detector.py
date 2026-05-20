"""Detect understaffed shifts and missing certification coverage."""

from __future__ import annotations

from collections import defaultdict

from app.services.scheduling_engine.types import DraftAssignment, DraftConflict, StaffingGap, StaffingRequirement


class GapDetector:
    def detect(
        self,
        requirements: list[StaffingRequirement],
        assignments: list[DraftAssignment],
        conflicts: list[DraftConflict],
        *,
        covered_by_existing: dict[tuple[str, str], int],
    ) -> list[StaffingGap]:
        gaps: list[StaffingGap] = []
        assigned_counts: dict[tuple[str, str], int] = defaultdict(int)
        for a in assignments:
            key = (a.slot.date.isoformat(), a.slot.shift_type)
            assigned_counts[key] += 1

        cert_assigned: dict[tuple[str, str, str], int] = defaultdict(int)
        for a in assignments:
            for c in a.slot.required_certs:
                cert_assigned[(a.slot.date.isoformat(), a.slot.shift_type, c.upper())] += 1

        for req in requirements:
            key = (req.date.isoformat(), req.shift_type)
            have = assigned_counts[key] + covered_by_existing.get(key, 0)
            shortfall = req.required_count - have
            if shortfall > 0:
                gaps.append(
                    StaffingGap(
                        date=req.date.isoformat(),
                        shift_type=req.shift_type,
                        message=f"{req.date.strftime('%A')} {req.shift_type} understaffed by {shortfall}",
                        shortfall=shortfall,
                    )
                )
            for cert in req.required_certifications:
                ck = (req.date.isoformat(), req.shift_type, cert.upper())
                if cert_assigned[ck] < 1 and shortfall >= 0:
                    gaps.append(
                        StaffingGap(
                            date=req.date.isoformat(),
                            shift_type=req.shift_type,
                            message=f"Missing {cert}-certified coverage",
                            shortfall=1,
                            missing_certifications=[cert],
                        )
                    )

        for c in conflicts:
            gaps.append(
                StaffingGap(
                    date=c.slot.date.isoformat(),
                    shift_type=c.slot.shift_type,
                    message=c.reason,
                    shortfall=1,
                )
            )
        return gaps
