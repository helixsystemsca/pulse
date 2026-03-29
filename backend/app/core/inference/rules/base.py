"""
Pluggable inference rules — no core hardcoding.

Subclass or implement the protocol, register in ``app.core.inference.rules.registry``.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Protocol, runtime_checkable

if TYPE_CHECKING:
    from app.core.events.types import DomainEvent
    from app.core.inference.context import InferenceContext
    from app.core.inference.outcome import InferenceOutcome


@runtime_checkable
class InferenceRule(Protocol):
    """Contract for async, event-driven rules."""

    name: str
    trigger_event_types: frozenset[str]
    min_confidence: float
    priority: int

    async def evaluate(self, event: DomainEvent, ctx: InferenceContext) -> list[InferenceOutcome]: ...
