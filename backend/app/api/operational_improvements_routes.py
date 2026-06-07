"""Operational improvements workflow API."""

from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_any_rbac, require_tenant_user
from app.models.domain import User
from app.schemas.operational_improvements import (
    OperationalImprovementActionCreateIn,
    OperationalImprovementActionOut,
    OperationalImprovementActionPatchIn,
    OperationalImprovementAnalysisCreateIn,
    OperationalImprovementAnalysisOut,
    OperationalImprovementAnalysisPatchIn,
    OperationalImprovementAttachmentCreateIn,
    OperationalImprovementAttachmentOut,
    OperationalImprovementCaseStudyOut,
    OperationalImprovementCreateIn,
    OperationalImprovementListOut,
    OperationalImprovementOut,
    OperationalImprovementPatchIn,
    OperationalImprovementStatsOut,
)
from app.services import operational_improvements_service as svc

router = APIRouter(prefix="/operational-improvements", tags=["operational-improvements"])

Db = Annotated[AsyncSession, Depends(get_db)]
CompanyId = Annotated[str, Depends(lambda u=Depends(require_tenant_user): str(u.company_id))]
Actor = Annotated[User, Depends(require_tenant_user)]
OiReader = Annotated[User, Depends(require_any_rbac("operational_improvements.view", "operational_improvements.manage"))]
OiEditor = Annotated[User, Depends(require_any_rbac("operational_improvements.manage"))]


def _detail(row) -> OperationalImprovementOut:
    return OperationalImprovementOut.model_validate(svc._improvement_dict(row))


def _list(row) -> OperationalImprovementListOut:
    return OperationalImprovementListOut.model_validate(svc._list_dict(row))


@router.get("/stats", response_model=OperationalImprovementStatsOut)
async def operational_improvements_stats(db: Db, cid: CompanyId, _: OiReader) -> OperationalImprovementStatsOut:
    return OperationalImprovementStatsOut.model_validate(await svc.compute_stats(db, cid))


@router.get("/knowledge-base", response_model=list[OperationalImprovementCaseStudyOut])
async def list_knowledge_base(
    db: Db,
    cid: CompanyId,
    _: OiReader,
    q: Optional[str] = Query(None, max_length=200),
) -> list[OperationalImprovementCaseStudyOut]:
    rows = await svc.list_case_studies(db, cid, q=q)
    return [OperationalImprovementCaseStudyOut.model_validate(r) for r in rows]


@router.get("", response_model=list[OperationalImprovementListOut])
async def list_operational_improvements(
    db: Db,
    cid: CompanyId,
    _: OiReader,
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    q: Optional[str] = Query(None, max_length=200),
) -> list[OperationalImprovementListOut]:
    rows = await svc.list_improvements(db, cid, status=status, category=category, q=q)
    return [_list(r) for r in rows]


@router.post("", response_model=OperationalImprovementOut, status_code=status.HTTP_201_CREATED)
async def create_operational_improvement(
    db: Db,
    cid: CompanyId,
    actor: OiEditor,
    body: OperationalImprovementCreateIn,
) -> OperationalImprovementOut:
    row = await svc.create_improvement(
        db,
        cid,
        str(actor.id),
        title=body.title,
        description=body.description,
        department_slug=body.department_slug,
        location=body.location,
        zone_id=body.zone_id,
        reporter_user_id=body.reporter_user_id,
        date_identified=body.date_identified,
        priority=body.priority,
        category=body.category,
        estimated_impact=body.estimated_impact,
        current_symptoms=body.current_symptoms,
        stakeholders_affected=body.stakeholders_affected,
        status=body.status,
    )
    await db.commit()
    loaded = await svc.get_improvement(db, cid, str(row.id))
    assert loaded
    return _detail(loaded)


@router.get("/{improvement_id}", response_model=OperationalImprovementOut)
async def get_operational_improvement(
    db: Db,
    cid: CompanyId,
    _: OiReader,
    improvement_id: str,
) -> OperationalImprovementOut:
    row = await svc.get_improvement(db, cid, improvement_id)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    return _detail(row)


@router.patch("/{improvement_id}", response_model=OperationalImprovementOut)
async def patch_operational_improvement(
    db: Db,
    cid: CompanyId,
    _: OiEditor,
    improvement_id: str,
    body: OperationalImprovementPatchIn,
) -> OperationalImprovementOut:
    row = await svc.get_improvement(db, cid, improvement_id)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    data = body.model_dump(exclude_unset=True)
    row = await svc.patch_improvement(db, row, **data)
    await db.commit()
    loaded = await svc.get_improvement(db, cid, improvement_id)
    assert loaded
    return _detail(loaded)


@router.delete("/{improvement_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_operational_improvement(
    db: Db,
    cid: CompanyId,
    _: OiEditor,
    improvement_id: str,
) -> None:
    row = await svc.get_improvement(db, cid, improvement_id, load_children=False)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    await svc.delete_improvement(db, row)
    await db.commit()


@router.post("/{improvement_id}/analyses", response_model=OperationalImprovementAnalysisOut, status_code=status.HTTP_201_CREATED)
async def create_analysis(
    db: Db,
    cid: CompanyId,
    actor: OiEditor,
    improvement_id: str,
    body: OperationalImprovementAnalysisCreateIn,
) -> OperationalImprovementAnalysisOut:
    row = await svc.get_improvement(db, cid, improvement_id, load_children=False)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    analysis = await svc.create_analysis(
        db,
        row,
        str(actor.id),
        analysis_type=body.analysis_type,
        title=body.title,
        data=body.data,
    )
    await db.commit()
    await db.refresh(analysis)
    return OperationalImprovementAnalysisOut.model_validate(svc._analysis_dict(analysis))


@router.patch("/analyses/{analysis_id}", response_model=OperationalImprovementAnalysisOut)
async def patch_analysis(
    db: Db,
    cid: CompanyId,
    _: OiEditor,
    analysis_id: str,
    body: OperationalImprovementAnalysisPatchIn,
) -> OperationalImprovementAnalysisOut:
    analysis = await svc.get_analysis(db, cid, analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Not found")
    data = body.model_dump(exclude_unset=True)
    analysis = await svc.patch_analysis(db, analysis, **data)
    await db.commit()
    await db.refresh(analysis)
    return OperationalImprovementAnalysisOut.model_validate(svc._analysis_dict(analysis))


@router.delete("/analyses/{analysis_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_analysis(
    db: Db,
    cid: CompanyId,
    _: OiEditor,
    analysis_id: str,
) -> None:
    analysis = await svc.get_analysis(db, cid, analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Not found")
    await svc.delete_analysis(db, analysis)
    await db.commit()


@router.post("/{improvement_id}/actions", response_model=OperationalImprovementActionOut, status_code=status.HTTP_201_CREATED)
async def create_action(
    db: Db,
    cid: CompanyId,
    _: OiEditor,
    improvement_id: str,
    body: OperationalImprovementActionCreateIn,
) -> OperationalImprovementActionOut:
    row = await svc.get_improvement(db, cid, improvement_id, load_children=False)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    item = await svc.create_action(
        db,
        row,
        action=body.action,
        owner_user_id=body.owner_user_id,
        due_date=body.due_date,
        status=body.status,
        notes=body.notes,
        linked_work_request_id=body.linked_work_request_id,
        linked_project_id=body.linked_project_id,
    )
    await db.commit()
    await db.refresh(item)
    return OperationalImprovementActionOut.model_validate(svc._action_dict(item))


@router.patch("/actions/{action_id}", response_model=OperationalImprovementActionOut)
async def patch_action(
    db: Db,
    cid: CompanyId,
    _: OiEditor,
    action_id: str,
    body: OperationalImprovementActionPatchIn,
) -> OperationalImprovementActionOut:
    item = await svc.get_action(db, cid, action_id)
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    data = body.model_dump(exclude_unset=True)
    item = await svc.patch_action(db, item, **data)
    await db.commit()
    await db.refresh(item)
    return OperationalImprovementActionOut.model_validate(svc._action_dict(item))


@router.delete("/actions/{action_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_action(
    db: Db,
    cid: CompanyId,
    _: OiEditor,
    action_id: str,
) -> None:
    item = await svc.get_action(db, cid, action_id)
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    await svc.delete_action(db, item)
    await db.commit()


@router.post("/{improvement_id}/attachments", response_model=OperationalImprovementAttachmentOut, status_code=status.HTTP_201_CREATED)
async def create_attachment(
    db: Db,
    cid: CompanyId,
    actor: OiEditor,
    improvement_id: str,
    body: OperationalImprovementAttachmentCreateIn,
) -> OperationalImprovementAttachmentOut:
    row = await svc.get_improvement(db, cid, improvement_id, load_children=False)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    att = await svc.create_attachment(
        db,
        row,
        str(actor.id),
        file_name=body.file_name,
        file_url=body.file_url,
        attachment_type=body.attachment_type,
        caption=body.caption,
    )
    await db.commit()
    await db.refresh(att)
    return OperationalImprovementAttachmentOut.model_validate(svc._attachment_dict(att))


@router.delete("/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_attachment(
    db: Db,
    cid: CompanyId,
    _: OiEditor,
    attachment_id: str,
) -> None:
    att = await svc.get_attachment(db, cid, attachment_id)
    if not att:
        raise HTTPException(status_code=404, detail="Not found")
    await svc.delete_attachment(db, att)
    await db.commit()
