"""Balance assignment load across auxiliary pool."""

from __future__ import annotations


class FairnessEvaluator:
    def fairness_bonus(
        self,
        user_id: str,
        hours_assigned: dict[str, float],
        *,
        enabled: bool,
    ) -> tuple[float, list[str]]:
        if not enabled:
            return 0.0, []
        h = hours_assigned.get(user_id, 0.0)
        if h < 8:
            return 15.0, ["lighter weekly load"]
        if h < 24:
            return 8.0, []
        if h > 48:
            return -10.0, ["high weekly hours"]
        return 0.0, []
