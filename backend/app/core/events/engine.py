"""
Event engine — async publish/subscribe.

Handlers are invoked concurrently per publish. Persisting to `domain_events` is done
by optional subscribers (see `app.core.events.persist`).
"""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from typing import Awaitable, Callable, DefaultDict, List

from app.core.events.types import DomainEvent

Logger = logging.getLogger(__name__)

EventHandler = Callable[[DomainEvent], Awaitable[None]]


class EventEngine:
    """In-process pub/sub; swap for Redis/Kafka by implementing the same interface."""

    def __init__(self) -> None:
        self._subs: DefaultDict[str, List[EventHandler]] = defaultdict(list)
        self._wildcard: List[EventHandler] = []

    def subscribe(self, event_type: str, handler: EventHandler) -> None:
        """Register handler for a concrete event type; use '*' for all events."""
        if event_type == "*":
            self._wildcard.append(handler)
            return
        self._subs[event_type].append(handler)

    async def publish(self, event: DomainEvent) -> None:
        """Fan-out to subscribers; does not raise if a handler fails (logs instead)."""
        handlers = list(self._wildcard)
        handlers.extend(self._subs.get(event.event_type, []))
        if not handlers:
            return
        results = await asyncio.gather(
            *[self._safe_call(h, event) for h in handlers],
            return_exceptions=True,
        )
        for r in results:
            if isinstance(r, Exception):
                Logger.exception("Event handler error: %s", r)

    async def _safe_call(self, handler: EventHandler, event: DomainEvent) -> None:
        await handler(event)


# App-wide singleton; replace via dependency override in tests.
event_engine = EventEngine()
