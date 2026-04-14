"""Shared work-request helpers for API + Pulse."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from app.models.pulse_models import PulseWorkRequest, PulseWorkRequestPriority, PulseWorkRequestStatus

# Re-export for routers that need the raw defaults structure.
DEFAULT_WR_SETTINGS: dict[str, Any] = {
    "statuses": {"open": True, "in_progress": True, "hold": True, "completed": True, "cancelled": True},
    "priority_colors": {
        "low": "#64748b",
        "medium": "#3182ce",
        "high": "#dd6b20",
        "critical": "#c53030",
    },
    "sla_hours": {"critical": 24, "high": 48, "medium": 72, "low": 168},
    "assignment_rules": {"default_by": "asset"},
    "notifications": {"new_request": True, "assignment": True, "overdue": True},
}


def merge_wr_settings(stored: Optional[dict[str, Any]]) -> dict[str, Any]:
    out = dict(DEFAULT_WR_SETTINGS)
    if stored:
        for k, v in stored.items():
            if isinstance(v, dict) and isinstance(out.get(k), dict):
                merged = dict(out[k])
                merged.update(v)
                out[k] = merged
            else:
                out[k] = v
    return out


def display_status(wr: PulseWorkRequest, now: Optional[datetime] = None) -> str:
    now = now or datetime.now(timezone.utc)
    st = wr.status
    if st == PulseWorkRequestStatus.completed:
        return "completed"
    if st == PulseWorkRequestStatus.cancelled:
        return "cancelled"
    if st == PulseWorkRequestStatus.hold:
        return "hold"
    if (
        wr.due_date
        and wr.due_date < now
        and st != PulseWorkRequestStatus.completed
        and st != PulseWorkRequestStatus.hold
    ):
        return "overdue"
    return st.value


def default_due_date_for_priority(pr: PulseWorkRequestPriority, settings: dict[str, Any]) -> datetime:
    hours = int(merge_wr_settings(settings)["sla_hours"].get(pr.value, 72))
    return datetime.now(timezone.utc) + timedelta(hours=hours)


def priority_from_legacy_int(v: int) -> PulseWorkRequestPriority:
    if v <= 0:
        return PulseWorkRequestPriority.low
    if v == 1:
        return PulseWorkRequestPriority.medium
    if v == 2:
        return PulseWorkRequestPriority.high
    return PulseWorkRequestPriority.critical
