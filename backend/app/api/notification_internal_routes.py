"""Internal hooks for the project notification engine (cron / workers)."""

from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.config import get_settings
from app.core.security.internal_cron import verify_internal_cron_secret
from app.core.security.tenant_rls import apply_pulse_rls_system_context
from app.limiter import limiter
from app.services.notifications import run_all_rule_evaluations

router = APIRouter(prefix="/internal/notifications", tags=["internal-notifications"])

Db = Annotated[AsyncSession, Depends(get_db)]


@router.post("/run-evaluations")
@limiter.limit("30/minute")
async def run_notification_rule_evaluations(
    request: Request,
    db: Db,
    x_notification_cron_secret: Annotated[Optional[str], Header(alias="X-Notification-Cron-Secret")] = None,
    x_cron_timestamp: Annotated[Optional[str], Header(alias="X-Cron-Timestamp")] = None,
) -> dict[str, int | str]:
    """
    Evaluate all enabled notification rules for the current calendar day (UTC).

    Intended for a daily cron job. Configure ``NOTIFICATION_CRON_SECRET`` and send it as
    ``X-Notification-Cron-Secret``. Optional ``X-Cron-Timestamp`` (unix seconds) limits replay.
    """
    settings = get_settings()
    verify_internal_cron_secret(
        configured_secret=settings.notification_cron_secret,
        provided_secret=x_notification_cron_secret,
        header_name="X-Notification-Cron-Secret",
        cron_timestamp=x_cron_timestamp,
    )
    await apply_pulse_rls_system_context(db)
    return await run_all_rule_evaluations(db)
