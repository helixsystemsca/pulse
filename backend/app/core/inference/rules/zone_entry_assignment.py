"""
Example rule: zone entry + optional worker hint → tool_assigned (confidence from signal quality).

Extend by adding more conditions or replacing this class in the registry — core stays dumb.
"""

from __future__ import annotations

from typing import List

from sqlalchemy import select

from app.core.events.types import DomainEvent
from app.core.inference.context import InferenceContext
from app.core.inference.derived_types import TOOL_ASSIGNED
from app.core.inference.outcome import InferenceOutcome
from app.models.domain import Tool, User


class ZoneEntryAssignmentRule:
    """Maps ``zone.entry`` (+ worker proximity hints in metadata) to ``tool_assigned``."""

    name = "zone_entry_assignment"
    trigger_event_types = frozenset({"zone.entry"})
    min_confidence = 0.5
    priority = 10

    async def evaluate(self, event: DomainEvent, ctx: InferenceContext) -> List[InferenceOutcome]:
        meta = event.metadata
        worker_id = meta.get("worker_user_id") or meta.get("worker_id")
        tag_id = meta.get("tag_id")
        if not tag_id or not worker_id:
            return []

        q = await ctx.db.execute(
            select(Tool).where(Tool.company_id == event.company_id, Tool.tag_id == tag_id)
        )
        tool = q.scalar_one_or_none()
        if not tool:
            return []

        uq = await ctx.db.execute(select(User).where(User.id == worker_id, User.company_id == event.company_id))
        if uq.scalar_one_or_none() is None:
            return []

        base = 0.55
        signal = meta.get("signal_strength")
        if isinstance(signal, (int, float)):
            base = min(0.99, base + float(signal) * 0.35)

        zone_match = meta.get("zone_id")
        if zone_match and tool.zone_id and zone_match == tool.zone_id:
            base = min(0.99, base + 0.15)

        return [
            InferenceOutcome(
                derived_event_type=TOOL_ASSIGNED,
                confidence=base,
                entity_id=tool.id,
                metadata={
                    "tool_id": tool.id,
                    "tag_id": tag_id,
                    "worker_user_id": worker_id,
                    "zone_id": zone_match,
                },
            )
        ]
