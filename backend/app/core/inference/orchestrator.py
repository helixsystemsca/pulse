"""
Inference orchestrator — subscribes to the event bus, runs pluggable rules, publishes outcomes.

No domain logic here: only scheduling, thresholds, and error isolation.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Sequence

from app.core.config import get_settings
from app.core.database import AsyncSessionLocal
from app.core.events.engine import EventEngine
from app.core.events.types import DomainEvent
from app.core.inference.context import InferenceContext

logger = logging.getLogger(__name__)


class InferenceOrchestrator:
    def __init__(self, bus: EventEngine, rules: Sequence[object]) -> None:
        self._bus = bus
        self._rules = sorted(rules, key=lambda r: getattr(r, "priority", 100))

    def attach(self) -> None:
        self._bus.subscribe("*", self._on_event)

    async def _on_event(self, event: DomainEvent) -> None:
        if event.metadata.get("inference_derivation"):
            return

        settings = get_settings()
        try:
            async with AsyncSessionLocal() as session:
                now = datetime.now(timezone.utc)
                ctx = InferenceContext(
                    db=session,
                    now=now,
                    global_min_confidence=settings.inference_min_confidence,
                )
                for rule in self._rules:
                    triggers: frozenset = getattr(rule, "trigger_event_types", frozenset())
                    if event.event_type not in triggers:
                        continue
                    try:
                        outcomes = await rule.evaluate(event, ctx)
                    except Exception:
                        logger.exception("inference rule failed: %s", getattr(rule, "name", rule))
                        continue
                    floor = max(
                        float(getattr(rule, "min_confidence", 0.0)),
                        ctx.global_min_confidence,
                    )
                    rname = str(getattr(rule, "name", "anonymous"))
                    for o in outcomes:
                        if o.confidence < floor:
                            continue
                        derived = o.to_domain_event(event, rname)
                        await self._bus.publish(derived)
        except Exception:
            logger.exception("inference orchestrator session error")
