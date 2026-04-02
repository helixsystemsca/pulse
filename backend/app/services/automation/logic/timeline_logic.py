"""Handlers for session / notification lifecycle events (observability; minimal side effects)."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.automation_engine import AutomationEvent


async def handle(db: AsyncSession, event: AutomationEvent) -> None:
    payload = dict(event.payload or {})
    if payload.get("rate_limited"):
        return
    # Events are durable in automation_events; optional logic can log or integrate later.
