"""Pulse product module (tenant-scoped REST)."""

from app.modules.pulse.router import router as pulse_router

__all__ = ["pulse_router"]
