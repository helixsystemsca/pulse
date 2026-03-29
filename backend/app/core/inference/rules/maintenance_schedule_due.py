"""
Time-based rule: compares schedule ``next_due_at`` to ``ctx.now``.

Triggers on schedule lifecycle events so new schedules are evaluated immediately.
"""

from __future__ import annotations

from typing import List, Optional

from app.core.events.types import DomainEvent
from app.core.inference.context import InferenceContext
from app.core.inference.derived_types import MAINTENANCE_INFERRED
from app.core.inference.outcome import InferenceOutcome
from app.models.domain import MaintenanceSchedule


class MaintenanceScheduleDueRule:
    name = "maintenance_schedule_due"
    trigger_event_types = frozenset(
        {
            "maintenance.schedule_created",
            "maintenance.inference_due",
        }
    )
    min_confidence = 0.5
    priority = 30

    async def evaluate(self, event: DomainEvent, ctx: InferenceContext) -> List[InferenceOutcome]:
        sid: Optional[str] = event.metadata.get("schedule_id")
        if not sid:
            return []
        row = await ctx.db.get(MaintenanceSchedule, sid)
        if row is None or row.company_id != event.company_id:
            return []

        due = row.next_due_at
        if due is None:
            if event.event_type == "maintenance.inference_due":
                return [
                    InferenceOutcome(
                        derived_event_type=MAINTENANCE_INFERRED,
                        confidence=0.72,
                        entity_id=row.id,
                        metadata={
                            "schedule_id": row.id,
                            "tool_id": row.tool_id,
                            "reason": "inference_hint_no_calendar_anchor",
                        },
                    )
                ]
            return []

        if due <= ctx.now:
            days_past = (ctx.now - due).total_seconds() / 86400.0
            conf = min(0.97, 0.7 + min(0.25, days_past * 0.05))
            return [
                InferenceOutcome(
                    derived_event_type=MAINTENANCE_INFERRED,
                    confidence=conf,
                    entity_id=row.id,
                    metadata={
                        "schedule_id": row.id,
                        "tool_id": row.tool_id,
                        "reason": "due_time_elapsed",
                        "next_due_at": due.isoformat(),
                    },
                )
            ]

        return []
