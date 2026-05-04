"""Project summary HTTP API (`/projects/{project_id}/summary*`)."""

from __future__ import annotations

import json
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_tenant_user
from app.api.projects_routes import _actor_can_manage_pulse_project
from app.core.database import get_db
from app.models.domain import User
from app.models.pulse_models import PulseProject
from app.models.project_summary_models import ProjectSummary as ProjectSummaryRecord
from app.models.project_summary_models import ProjectSummaryStatus
from app.schemas.project_summary import (
    ProjectSummaryFinalizeIn,
    ProjectSummarySaveDraftIn,
    ProjectSummaryStorageStateOut,
    ProjectSummaryStoredOut,
)
from app.services.project_summary.schemas import ProjectSummary as ProjectSummaryDoc
from app.services.project_summary.service import (
    generate_project_summary,
    persistable_snapshot_bundle,
    rehydrate_project_summary,
)
from app.services.project_summary import store as summary_store


async def _company_id(user: User = Depends(require_tenant_user)) -> str:
    assert user.company_id is not None
    return str(user.company_id)


CompanyId = Annotated[str, Depends(_company_id)]
Db = Annotated[AsyncSession, Depends(get_db)]

router = APIRouter(tags=["projects"])


async def _require_project(db: Db, cid: CompanyId, project_id: str) -> PulseProject:
    p = await db.get(PulseProject, project_id)
    if not p or str(p.company_id) != cid:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return p


def _stored_row_out(row: ProjectSummaryRecord) -> ProjectSummaryStoredOut:
    st = row.status.value if hasattr(row.status, "value") else str(row.status)
    if st not in ("draft", "finalized"):
        st = "draft"
    return ProjectSummaryStoredOut(
        id=str(row.id),
        project_id=str(row.project_id),
        status=st,  # type: ignore[arg-type]
        snapshot_json=dict(row.snapshot_json or {}),
        metrics_json=dict(row.metrics_json or {}),
        user_inputs_json=dict(row.user_inputs_json or {}),
        created_at=row.created_at,
        finalized_at=row.finalized_at,
    )


def _format_snapshot_text(snapshot: dict[str, Any]) -> str:
    lines: list[str] = ["Project summary (export)", "=" * 40, ""]
    lines.append(f"Project ID: {snapshot.get('project_id', '')}")
    lines.append("")
    for key in (
        "overview",
        "scope",
        "schedule",
        "resources",
        "quality",
        "risks",
        "communication",
        "stakeholders",
        "lessons",
        "outcome",
    ):
        if key not in snapshot:
            continue
        lines.append(key.upper())
        lines.append(json.dumps(snapshot[key], indent=2, default=str))
        lines.append("")
    return "\n".join(lines).rstrip()


@router.get("/projects/{project_id}/summary/storage", response_model=ProjectSummaryStorageStateOut)
async def get_project_summary_storage_state(db: Db, cid: CompanyId, project_id: str) -> ProjectSummaryStorageStateOut:
    """Return whether a draft and/or finalized summary row exists for closeout UI."""
    await _require_project(db, cid, project_id)
    draft = await summary_store.fetch_latest_summary(db, project_id, status=ProjectSummaryStatus.draft)
    finalized = await summary_store.fetch_latest_summary(db, project_id, status=ProjectSummaryStatus.finalized)
    return ProjectSummaryStorageStateOut(has_draft=draft is not None, has_finalized=finalized is not None)


@router.get("/projects/{project_id}/summary", response_model=ProjectSummaryDoc)
async def get_project_summary_draft(db: Db, cid: CompanyId, project_id: str) -> ProjectSummaryDoc:
    """Generate a draft summary without persisting."""
    await _require_project(db, cid, project_id)
    return generate_project_summary(project_id)


@router.post(
    "/projects/{project_id}/summary",
    response_model=ProjectSummaryStoredOut,
    status_code=status.HTTP_200_OK,
)
async def save_project_summary_draft(
    db: Db,
    cid: CompanyId,
    actor: Annotated[User, Depends(require_tenant_user)],
    project_id: str,
    body: ProjectSummarySaveDraftIn,
) -> ProjectSummaryStoredOut:
    """Persist (or refresh) the latest draft summary for the project."""
    p = await _require_project(db, cid, project_id)
    if not _actor_can_manage_pulse_project(actor, p):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the project creator, owner, or a company administrator can save a summary",
        )
    snapshot_json, metrics_json, _doc = persistable_snapshot_bundle(project_id)
    row = await summary_store.upsert_draft(
        db,
        project_id,
        snapshot_json=snapshot_json,
        metrics_json=metrics_json,
        user_inputs_json=dict(body.user_inputs),
    )
    await db.commit()
    await db.refresh(row)
    return _stored_row_out(row)


@router.put("/projects/{project_id}/summary/finalize", response_model=ProjectSummaryStoredOut)
async def finalize_project_summary(
    db: Db,
    cid: CompanyId,
    actor: Annotated[User, Depends(require_tenant_user)],
    project_id: str,
    body: ProjectSummaryFinalizeIn,
) -> ProjectSummaryStoredOut:
    """Mark the current draft finalized and merge ``user_inputs`` into storage."""
    p = await _require_project(db, cid, project_id)
    if not _actor_can_manage_pulse_project(actor, p):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the project creator, owner, or a company administrator can finalize a summary",
        )
    try:
        row = await summary_store.finalize_latest_draft(
            db, project_id, user_inputs_patch=dict(body.user_inputs)
        )
    except ValueError as e:
        if str(e) == "no_draft_summary":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No draft summary exists for this project",
            ) from e
        raise
    await db.commit()
    await db.refresh(row)
    return _stored_row_out(row)


@router.get("/projects/{project_id}/summary/export", response_model=None)
async def export_project_summary(
    db: Db,
    cid: CompanyId,
    project_id: str,
    export_format: Literal["json", "text"] = Query("json", alias="format"),
) -> dict[str, Any] | PlainTextResponse:
    """Return the latest stored summary as JSON or plain text."""
    await _require_project(db, cid, project_id)
    row = await summary_store.fetch_row_for_export(db, project_id)
    if row is None:
        doc = generate_project_summary(project_id)
        snap = doc.model_dump(mode="json")
    else:
        try:
            doc = rehydrate_project_summary(
                project_id,
                dict(row.snapshot_json or {}),
                dict(row.metrics_json or {}),
            )
        except ValueError:
            doc = generate_project_summary(project_id)
        snap = doc.model_dump(mode="json")
        if row.user_inputs_json:
            snap["user_inputs"] = dict(row.user_inputs_json)
    if export_format == "text":
        return PlainTextResponse(_format_snapshot_text(snap), media_type="text/plain; charset=utf-8")
    return snap
