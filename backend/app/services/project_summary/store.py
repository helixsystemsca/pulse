"""Persistence helpers for stored project summaries (draft / finalized)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project_summary_models import ProjectSummary as ProjectSummaryRecord
from app.models.project_summary_models import ProjectSummaryStatus


async def fetch_latest_summary(
    db: AsyncSession,
    project_id: str,
    *,
    status: Optional[ProjectSummaryStatus] = None,
) -> Optional[ProjectSummaryRecord]:
    stmt = select(ProjectSummaryRecord).where(ProjectSummaryRecord.project_id == project_id)
    if status is not None:
        stmt = stmt.where(ProjectSummaryRecord.status == status)
    stmt = stmt.order_by(ProjectSummaryRecord.created_at.desc()).limit(1)
    q = await db.execute(stmt)
    return q.scalar_one_or_none()


async def upsert_draft(
    db: AsyncSession,
    project_id: str,
    *,
    snapshot_json: dict[str, Any],
    metrics_json: dict[str, Any],
    user_inputs_json: dict[str, Any],
) -> ProjectSummaryRecord:
    row = await fetch_latest_summary(db, project_id, status=ProjectSummaryStatus.draft)
    if row:
        row.snapshot_json = snapshot_json
        row.metrics_json = metrics_json
        row.user_inputs_json = {**dict(row.user_inputs_json or {}), **user_inputs_json}
        await db.flush()
        return row
    rec = ProjectSummaryRecord(
        project_id=project_id,
        snapshot_json=snapshot_json,
        metrics_json=metrics_json,
        user_inputs_json=user_inputs_json,
        status=ProjectSummaryStatus.draft,
    )
    db.add(rec)
    await db.flush()
    return rec


async def finalize_latest_draft(
    db: AsyncSession,
    project_id: str,
    *,
    user_inputs_patch: dict[str, Any],
) -> ProjectSummaryRecord:
    row = await fetch_latest_summary(db, project_id, status=ProjectSummaryStatus.draft)
    if not row:
        raise ValueError("no_draft_summary")
    merged = {**dict(row.user_inputs_json or {}), **user_inputs_patch}
    row.user_inputs_json = merged
    row.status = ProjectSummaryStatus.finalized
    row.finalized_at = datetime.now(timezone.utc)
    await db.flush()
    return row


async def fetch_row_for_export(
    db: AsyncSession,
    project_id: str,
) -> Optional[ProjectSummaryRecord]:
    """Latest finalized summary row, else latest draft; ``None`` if nothing stored."""
    fin = await fetch_latest_summary(db, project_id, status=ProjectSummaryStatus.finalized)
    if fin is not None:
        return fin
    return await fetch_latest_summary(db, project_id, status=ProjectSummaryStatus.draft)
