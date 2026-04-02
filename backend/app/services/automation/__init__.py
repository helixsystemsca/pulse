"""Controlled automation engine (events → logic → config → state → actions)."""

from app.services.automation.event_processor import process_event

__all__ = ["process_event"]
