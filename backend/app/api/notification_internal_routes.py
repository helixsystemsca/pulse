"""Internal hooks for the project notification engine (cron / workers)."""

from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.config import get_settings
from app.services.notifications import run_all_rule_evaluations

router = APIRouter(prefix="/internal/notifications", tags=["internal-notifications"])

Db = Annotated[AsyncSession, Depends(get_db)]


@router.post("/run-evaluations")
async def run_notification_rule_evaluations(
    db: Db,
    x_notification_cron_secret: Annotated[Optional[str], Header(alias="X-Notification-Cron-Secret")] = None,
) -> dict[str, int | str]:
    """
    Evaluate all enabled notification rules for the current calendar day (UTC).

    Intended for a daily cron job. Configure ``NOTIFICATION_CRON_SECRET`` and send it as
    ``X-Notification-Cron-Secret``.
    """
    settings = get_settings()
    secret = (settings.notification_cron_secret or "").strip()
    if not secret:
        raise HTTPException(status_code=503, detail="NOTIFICATION_CRON_SECRET is not configured")
    if (x_notification_cron_secret or "").strip() != secret:
        raise HTTPException(status_code=401, detail="Invalid notification cron secret")
    return await run_all_rule_evaluations(db)
