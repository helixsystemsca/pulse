"""Liveness / readiness for load balancers and orchestration (see docs/LAUNCH_READINESS.md)."""

from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_live() -> dict[str, str]:
    """Process is up; does not check dependencies."""
    return {"status": "ok", "service": "pulse-api"}


@router.get("/health/ready")
async def health_ready(
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    """Database reachable; extend with Redis/S3 checks when those become hard dependencies."""
    try:
        await db.execute(text("SELECT 1"))
    except Exception:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "not_ready", "database": "error"}
    return {"status": "ready", "database": "ok"}
