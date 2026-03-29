"""Maps raw missing-tag signals to unified ``tool_missing`` with calibrated confidence."""

from __future__ import annotations

from typing import List

from sqlalchemy import select

from app.core.events.types import DomainEvent
from app.core.inference.context import InferenceContext
from app.core.inference.derived_types import TOOL_MISSING
from app.core.inference.outcome import InferenceOutcome
from app.models.domain import Tool


class MissingToolSignalRule:
    name = "missing_tool_signal"
    trigger_event_types = frozenset({"tool.missing_detected", "tool.missing_scan_complete"})
    min_confidence = 0.4
    priority = 20

    async def evaluate(self, event: DomainEvent, ctx: InferenceContext) -> List[InferenceOutcome]:
        out: List[InferenceOutcome] = []
        meta = event.metadata

        if event.event_type == "tool.missing_detected":
            tag = meta.get("tag_id")
            if not tag:
                return []
            conf = float(meta.get("confidence", 0.92))
            tool_id = None
            q = await ctx.db.execute(
                select(Tool).where(Tool.company_id == event.company_id, Tool.tag_id == tag)
            )
            t = q.scalar_one_or_none()
            if t:
                tool_id = t.id
            out.append(
                InferenceOutcome(
                    derived_event_type=TOOL_MISSING,
                    confidence=min(0.99, conf),
                    entity_id=tool_id,
                    metadata={"tag_id": tag, "source_event": event.event_type},
                )
            )
            return out

        # tool.missing_scan_complete: optional list under "missing"
        missing_list = meta.get("missing") or []
        if isinstance(missing_list, list):
            n = max(1, len(missing_list))
            for tag in missing_list:
                if not isinstance(tag, str):
                    continue
                q = await ctx.db.execute(
                    select(Tool).where(Tool.company_id == event.company_id, Tool.tag_id == tag)
                )
                t = q.scalar_one_or_none()
                tool_id = t.id if t else None
                out.append(
                    InferenceOutcome(
                        derived_event_type=TOOL_MISSING,
                        confidence=max(0.5, 0.95 - 0.03 * n),
                        entity_id=tool_id,
                        metadata={"tag_id": tag, "batch_size": n, "source_event": event.event_type},
                    )
                )
        return out
