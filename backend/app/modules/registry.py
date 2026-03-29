"""
Central registration for module routers.

Routers are always mounted; individual routes gate on feature flags via dependencies,
so disabled modules return 404 and never run module logic.
"""

from fastapi import FastAPI

from app.api.realtime import attach_event_bridge
from app.core.events.persist_subscriber import attach_persist_subscriber
from app.core.inference.bootstrap import attach_inference_orchestrator


def register_modules(app: FastAPI) -> None:
    """Include all module routers, persistence, inference orchestrator, and realtime bridge."""
    attach_persist_subscriber()
    attach_inference_orchestrator()
    from app.modules.analytics.router import router as analytics_router
    from app.modules.inventory.router import router as inventory_router
    from app.modules.jobs.router import router as jobs_router
    from app.modules.maintenance.router import router as maintenance_router
    from app.modules.notifications.router import router as notifications_router
    from app.modules.tool_tracking.router import router as tool_tracking_router

    app.include_router(tool_tracking_router, prefix="/api/v1")
    app.include_router(inventory_router, prefix="/api/v1")
    app.include_router(maintenance_router, prefix="/api/v1")
    app.include_router(jobs_router, prefix="/api/v1")
    app.include_router(notifications_router, prefix="/api/v1")
    app.include_router(analytics_router, prefix="/api/v1")

    attach_event_bridge()
