"""Proximity opportunity logging, missed detection, periodic escalation passes."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pulse_models import (
    PulseBeaconEquipment,
    PulseProjectTask,
    PulseProximityEventLog,
    PulseTaskStatus,
)
from app.modules.pulse import project_automation_engine as pae

MISSED_THRESHOLD_SEC = 300
STALE_SECONDS = 86400


async def log_proximity_offer(
    db: AsyncSession,
    company_id: str,
    user_id: str,
    location_tag_id: str,
    task_ids: list[str],
) -> str | None:
    """Persist an offered batch of ready tasks; call only when task_ids non-empty."""
    if not task_ids:
        return None
    row = PulseProximityEventLog(
        company_id=company_id,
        user_id=user_id,
        location_tag_id=location_tag_id[:128],
        tasks_present=[str(x) for x in task_ids],
    )
    db.add(row)
    await db.flush()
    return str(row.id)


async def resolve_proximity_for_task(
    db: AsyncSession,
    company_id: str,
    user_id: str,
    task_id: str,
) -> None:
    """Mark the latest matching open proximity offer as actioned."""
    tid = str(task_id)
    uid = str(user_id)
    q = await db.execute(
        select(PulseProximityEventLog)
        .where(
            PulseProximityEventLog.company_id == company_id,
            PulseProximityEventLog.user_id == uid,
            PulseProximityEventLog.action_taken.is_(False),
            PulseProximityEventLog.is_missed.is_(False),
        )
        .order_by(PulseProximityEventLog.detected_at.desc())
        .limit(50)
    )
    for row in q.scalars().all():
        tp = row.tasks_present
        if not isinstance(tp, list):
            continue
        ids = [str(x) for x in tp]
        if tid in ids:
            row.action_taken = True
            row.action_task_id = tid
            row.resolved_at = datetime.now(timezone.utc)
            await db.flush()
            return


async def evaluate_missed_proximity_events(
    db: AsyncSession,
    company_id: str,
    threshold_seconds: int = MISSED_THRESHOLD_SEC,
) -> None:
    """Flag unresolved offers past threshold and run `proximity_missed` automation per affected project."""
    now = datetime.now(timezone.utc)
    q = await db.execute(
        select(PulseProximityEventLog).where(
            PulseProximityEventLog.company_id == company_id,
            PulseProximityEventLog.action_taken.is_(False),
            PulseProximityEventLog.is_missed.is_(False),
        )
    )
    for row in q.scalars().all():
        age = (now - row.detected_at).total_seconds()
        if age <= threshold_seconds:
            continue
        row.is_missed = True
        row.missed_at = now
        await db.flush()
        ctx: dict[str, Any] = {
            "proximity_event_id": str(row.id),
            "location_tag_id": row.location_tag_id,
            "affected_user_id": str(row.user_id),
            "tasks_present": row.tasks_present if isinstance(row.tasks_present, list) else [],
        }
        tp = row.tasks_present or []
        if not isinstance(tp, list):
            continue
        project_ids: set[str] = set()
        anchors: dict[str, PulseProjectTask] = {}
        for raw_id in tp:
            t = await db.get(PulseProjectTask, str(raw_id))
            if not t or str(t.company_id) != company_id:
                continue
            pid = str(t.project_id)
            project_ids.add(pid)
            anchors.setdefault(pid, t)
        for pid in project_ids:
            anchor = anchors.get(pid)
            if anchor:
                await pae.run_proximity_missed_rules(db, company_id, pid, anchor, dict(ctx))


async def run_task_health_escalations(db: AsyncSession, company_id: str) -> None:
    """Run `task_overdue` / `task_stale` automation rules for incomplete work (periodic pass)."""
    q = await db.execute(
        select(PulseProjectTask).where(
            PulseProjectTask.company_id == company_id,
            PulseProjectTask.status != PulseTaskStatus.complete,
        )
    )
    tasks = list(q.scalars().all())
    seen: set[str] = set()
    for task in tasks:
        tid = str(task.id)
        if tid in seen:
            continue
        seen.add(tid)
        await pae.run_accountability_scan_rules(db, company_id, task)


async def equipment_label_for_tag(db: AsyncSession, company_id: str, tag: str) -> str:
    label = await db.scalar(
        select(PulseBeaconEquipment.location_label).where(
            PulseBeaconEquipment.company_id == company_id,
            PulseBeaconEquipment.beacon_id == tag,
        ).limit(1)
    )
    return (label or "").strip() or tag
