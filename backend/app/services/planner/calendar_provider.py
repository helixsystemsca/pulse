"""Calendar provider abstraction — internal/mock first; Outlook/Google later."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol


@dataclass(frozen=True)
class CalendarEvent:
    id: str
    title: str
    start_at: datetime
    end_at: datetime
    provider: str
    external_id: str | None = None


class CalendarProvider(Protocol):
    async def get_events(self, start: datetime, end: datetime) -> list[CalendarEvent]: ...

    async def create_event(self, title: str, start: datetime, end: datetime) -> CalendarEvent: ...

    async def update_event(self, event_id: str, **fields: object) -> CalendarEvent: ...

    async def delete_event(self, event_id: str) -> None: ...
