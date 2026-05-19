"""Employee availability checks (per-day table + profile windows)."""

from __future__ import annotations

from datetime import date
from typing import Any


class AvailabilityEvaluator:
    def is_available(
        self,
        worker: dict[str, Any],
        slot_date: date,
        *,
        availability_by_employee: dict[str, list[dict[str, Any]]] | None = None,
    ) -> tuple[bool, float, list[str]]:
        reasons: list[str] = []
        uid = str(worker.get("user_id") or worker.get("id"))
        rows = (availability_by_employee or {}).get(uid, [])
        day_rows = [r for r in rows if str(r.get("date")) == slot_date.isoformat()]

        if day_rows:
            for row in day_rows:
                status = (row.get("status") or "available").lower()
                if status == "unavailable":
                    return False, 0.0, ["marked unavailable"]
            statuses = {(r.get("status") or "").lower() for r in day_rows}
            if "available" in statuses:
                reasons.append("available")
                return True, 40.0, reasons
            if "open_pickup" in statuses:
                reasons.append("pickup eligible")
                return True, 32.0, reasons
            if "conditional" in statuses:
                reasons.append("conditional availability")
                return True, 30.0, reasons

        # No row for this day — pickup eligible (not blocked).
        if not day_rows:
            reasons.append("no availability row (pickup eligible)")
            return True, 28.0, reasons

        reasons.append("available")
        return True, 36.0, reasons
