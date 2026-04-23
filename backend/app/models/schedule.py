"""
Normalized schedule model for facility/program events.

We keep this intentionally small and stable so we can swap underlying providers
(Xplor Recreation now; other systems later) without touching frontend code.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ScheduleEvent(BaseModel):
    id: str
    program_name: str
    start_time: datetime
    end_time: datetime
    location: str
    staff: List[str] = Field(default_factory=list)
    status: Optional[str] = None


def transform_xplor_schedule(raw_data: Any) -> List[ScheduleEvent]:
    """
    Transform Xplor schedule payload into normalized `ScheduleEvent` list.

    This function is defensive: it ignores unknown shapes and returns best-effort results.
    Expected Xplor-like shape (mock follows this):
    {
      "schedules": [
        {
          "id": "...",
          "program_name": "...",
          "start_time": "2026-04-23T14:00:00-07:00",
          "end_time": "2026-04-23T15:30:00-07:00",
          "location": "Rink A",
          "staff": ["Name", ...],
          "status": "scheduled"
        }
      ]
    }
    """

    if raw_data is None:
        return []

    root: Dict[str, Any]
    if isinstance(raw_data, dict):
        root = raw_data
    else:
        return []

    rows = root.get("schedules")
    if not isinstance(rows, list):
        return []

    out: List[ScheduleEvent] = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        try:
            sid = str(r.get("id") or "")
            program = str(r.get("program_name") or r.get("name") or "").strip()
            location = str(r.get("location") or r.get("facility") or "").strip()
            if not sid or not program or not location:
                continue
            start_raw = r.get("start_time") or r.get("start") or r.get("starts_at")
            end_raw = r.get("end_time") or r.get("end") or r.get("ends_at")
            if not isinstance(start_raw, str) or not isinstance(end_raw, str):
                continue
            start_dt = datetime.fromisoformat(start_raw)
            end_dt = datetime.fromisoformat(end_raw)
            staff_raw = r.get("staff") or []
            staff: List[str] = []
            if isinstance(staff_raw, list):
                staff = [str(x).strip() for x in staff_raw if str(x).strip()]
            status = r.get("status")
            out.append(
                ScheduleEvent(
                    id=sid,
                    program_name=program,
                    start_time=start_dt,
                    end_time=end_dt,
                    location=location,
                    staff=staff,
                    status=str(status).strip() if status is not None and str(status).strip() else None,
                )
            )
        except Exception:
            # Skip malformed items; never explode the dashboard.
            continue
    return out

