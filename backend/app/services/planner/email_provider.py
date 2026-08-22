"""Email provider abstraction — review-queue only; no auto-created tasks.

Outlook/Gmail connectors implement this later. The MVP returns an empty queue.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Protocol


@dataclass(frozen=True)
class EmailSuggestion:
    id: str
    subject: str
    snippet: str
    suggested_title: str
    suggested_category: str | None
    suggested_priority: str
    suggested_due: date | None
    provider: str


class EmailProvider(Protocol):
    async def list_actionable(self) -> list[EmailSuggestion]: ...
