"""Internal schedule jobs (reminders, scans)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.config import get_settings
from app.models.domain import User
from app.models.pulse_models import PulseScheduleAcknowledgement, PulseScheduleAvailabilitySubmission, PulseSchedulePeriod

router = APIRouter(prefix="/internal/schedule", tags=["internal-schedule"])

Db = Annotated[AsyncSession, Depends(get_db)]


@router.post("/reminders/run")
async def run_schedule_reminders(
    db: Db,
    x_pm_cron_key: Annotated[Optional[str], Header(alias="X-PM-Cron-Key")] = None,
) -> dict:
    """
    Minimal “cron hook” for schedule reminders.

    Current behavior: returns counts of availability submissions / acknowledgements missing
    for periods with a deadline within the next 48 hours (best-effort; no notifications sent yet).
    """
    settings = get_settings()
    secret = (settings.pm_cron_secret or "").strip()
    if not secret:
        raise HTTPException(status_code=503, detail="PM_CRON_SECRET is not configured")
    if (x_pm_cron_key or "").strip() != secret:
        raise HTTPException(status_code=401, detail="Invalid cron key")

    now = datetime.now(timezone.utc)
    soon = now + timedelta(hours=48)

    periods = (
        (
            await db.execute(
                select(PulseSchedulePeriod).where(
                    PulseSchedulePeriod.availability_deadline.isnot(None),
                    PulseSchedulePeriod.availability_deadline >= now,
                    PulseSchedulePeriod.availability_deadline <= soon,
                )
            )
        )
        .scalars()
        .all()
    )

    out = []
    for p in periods:
        # NOTE: We don't have a canonical “schedule roster” table; use active users in company.
        users = (
            (await db.execute(select(User.id).where(User.company_id == p.company_id, User.is_active.is_(True))))
            .scalars()
            .all()
        )
        want = {str(u) for u in users}
        have = {
            str(x)
            for x in (
                (
                    await db.execute(
                        select(PulseScheduleAvailabilitySubmission.worker_id).where(
                            PulseScheduleAvailabilitySubmission.company_id == p.company_id,
                            PulseScheduleAvailabilitySubmission.period_id == p.id,
                        )
                    )
                )
                .scalars()
                .all()
            )
        }
        missing = sorted(want - have)
        out.append(
            {
                "period_id": str(p.id),
                "company_id": str(p.company_id),
                "availability_deadline": p.availability_deadline.isoformat() if p.availability_deadline else None,
                "missing_submissions": len(missing),
            }
        )

    # Acknowledgement reminders (unacknowledged published periods) — minimal stub:
    published = (
        (
            await db.execute(
                select(PulseSchedulePeriod).where(
                    PulseSchedulePeriod.status == "published",
                    PulseSchedulePeriod.publish_deadline.isnot(None),
                    PulseSchedulePeriod.publish_deadline >= now - timedelta(days=30),
                )
            )
        )
        .scalars()
        .all()
    )
    ack_out = []
    for p in published:
        users = (
            (await db.execute(select(User.id).where(User.company_id == p.company_id, User.is_active.is_(True))))
            .scalars()
            .all()
        )
        want = {str(u) for u in users}
        have = {
            str(x)
            for x in (
                (
                    await db.execute(
                        select(PulseScheduleAcknowledgement.worker_id).where(
                            PulseScheduleAcknowledgement.company_id == p.company_id,
                            PulseScheduleAcknowledgement.period_id == p.id,
                        )
                    )
                )
                .scalars()
                .all()
            )
        }
        ack_out.append(
            {
                "period_id": str(p.id),
                "company_id": str(p.company_id),
                "unacknowledged": len(sorted(want - have)),
            }
        )

    return {"ok": True, "availability": out, "acknowledgements": ack_out}

