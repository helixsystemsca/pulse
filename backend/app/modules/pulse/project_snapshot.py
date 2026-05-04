"""Project snapshot helper for future reporting.

This is intentionally UI-agnostic: it aggregates existing project/task/activity data into a
single payload for downstream report generation (PDF, exports, etc.).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pulse_models import (
    PulseProject,
    PulseProjectActivity,
    PulseProjectActivityType,
    PulseProjectTask,
    PulseTaskStatus,
)


async def generateProjectSnapshot(db: AsyncSession, *, company_id: str, project_id: str) -> dict[str, Any]:
    """Generate a lightweight snapshot of a project for future report generation."""

    p = await db.get(PulseProject, project_id)
    if not p or str(p.company_id) != str(company_id):
        raise ValueError("project_not_found")

    total_q = await db.scalar(
        select(func.count()).select_from(PulseProjectTask).where(PulseProjectTask.project_id == project_id)
    )
    done_q = await db.scalar(
        select(func.count())
        .select_from(PulseProjectTask)
        .where(PulseProjectTask.project_id == project_id, PulseProjectTask.status == PulseTaskStatus.complete)
    )
    total = int(total_q or 0)
    completed = int(done_q or 0)

    # Recent key activity entries (kept internal; UI can decide how to surface).
    aq = await db.execute(
        select(PulseProjectActivity)
        .where(
            PulseProjectActivity.project_id == project_id,
            PulseProjectActivity.type.in_(
                [PulseProjectActivityType.issue, PulseProjectActivityType.decision, PulseProjectActivityType.change]
            ),
        )
        .order_by(PulseProjectActivity.created_at.desc())
        .limit(25)
    )
    activity = list(aq.scalars().all())

    def _a_to_dict(a: PulseProjectActivity) -> dict[str, Any]:
        ty = a.type.value if hasattr(a.type, "value") else str(a.type)
        impact = getattr(getattr(a, "impact_level", None), "value", None) if getattr(a, "impact_level", None) else None
        return {
            "id": str(a.id),
            "type": ty,
            "title": a.title,
            "description": a.description,
            "impact_level": impact,
            "related_task_id": str(a.related_task_id) if getattr(a, "related_task_id", None) else None,
            "created_at": a.created_at,
        }

    # Timeline is a simple summary: planned vs target vs actual completion (if available).
    now = datetime.now(timezone.utc)
    timeline = {
        "target_start_date": p.start_date,
        "target_end_date": p.end_date,
        "completed_at": getattr(p, "completed_at", None),
        "generated_at": now,
    }

    return {
        "project": {
            "id": str(p.id),
            "name": p.name,
            "status": p.status.value if hasattr(p.status, "value") else str(p.status),
        },
        "counts": {"total_tasks": total, "completed_tasks": completed},
        "key_activity": [_a_to_dict(a) for a in activity],
        "timeline": timeline,
        "summary_fields": {
            "summary": getattr(p, "summary", None),
            "metrics": getattr(p, "metrics", None),
            "lessons_learned": getattr(p, "lessons_learned", None),
        },
    }

