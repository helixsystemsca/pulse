"""Structured output from a single rule evaluation step."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

from app.core.events.types import DomainEvent


@dataclass
class InferenceOutcome:
    """One proposed derived event with a confidence score."""

    derived_event_type: str
    confidence: float
    entity_id: Optional[str] = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_domain_event(self, parent: DomainEvent, rule_name: str) -> DomainEvent:
        """Build a platform event marked as inference output (orchestrator skips re-inferring these)."""
        meta = {
            **self.metadata,
            "confidence": self.confidence,
            "inference_rule": rule_name,
            "inference_derivation": True,
            "parent_event_type": parent.event_type,
            "parent_correlation_id": parent.correlation_id,
        }
        return DomainEvent(
            event_type=self.derived_event_type,
            company_id=parent.company_id,
            entity_id=self.entity_id,
            metadata=meta,
            source_module="inference",
        )
