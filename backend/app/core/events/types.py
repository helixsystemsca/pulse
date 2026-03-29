"""Platform event model — immutable records flowing through the event bus."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4


@dataclass(frozen=True)
class DomainEvent:
    """
    Immutable event envelope.

    * ``company_id``: tenant scope (formerly tenant_id).
    """

    event_type: str
    company_id: str
    metadata: dict[str, Any] = field(default_factory=dict)
    entity_id: Optional[str] = None
    source_module: Optional[str] = None
    correlation_id: str = field(default_factory=lambda: str(uuid4()))
    occurred_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def payload(self) -> dict[str, Any]:
        return self.metadata
