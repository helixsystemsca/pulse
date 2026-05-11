"""Tenant Maintenance hub — work orders (backed by pulse_work_requests), procedures, preventative rules."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Optional

from uuid import uuid4

from fastapi import APIRouter, Body, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import and_, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import Response

from app.api.deps import require_tenant_user, require_training_matrix_access
from app.core.database import get_db
from app.core.events.engine import event_engine
from app.core.events.types import DomainEvent
from app.core.pulse_storage import (
    read_procedure_assignment_photo_bytes,
    read_procedure_step_image_bytes,
    write_procedure_assignment_photo_bytes,
    write_procedure_step_image_bytes,
)
from app.models.domain import User, UserRole, Zone
from app.core.user_roles import user_has_any_role, user_has_tenant_full_admin
from app.models.pulse_models import (
    PulsePreventativeRule,
    PulseProcedure,
    PulseProcedureAssignment,
    PulseProcedureAssignmentPhoto,
    PulseProcedureAssignmentKind,
    PulseProcedureAssignmentStatus,
    PulseWorkOrderType,
    PulseWorkRequest,
    PulseWorkRequestPriority,
    PulseWorkRequestStatus,
    PulseProcedureComplianceSettings,
    PulseProcedureTrainingAcknowledgement,
    PulseProcedureWorkerCompletion,
)
from app.modules.pulse import service as pulse_svc
from app.services.pm_task_service import sync_pm_task_after_work_order_completed
from app.services.procedure_training.service import (
    latest_ack_revision_map,
    record_procedure_acknowledgement,
    record_procedure_signoff,
    resolve_compliance_defaults,
    revision_marker_from_procedure,
    verification_requires_quiz,
)
from app.services.procedure_verification.service import (
    QuizAttemptStats,
    complete_verification_quiz_session,
    create_quiz_session_for_employee,
    get_engagement_snapshot,
    load_attempt_stats_for_pairs,
    record_engagement_view,
)
from app.schemas.training import (
    ProcedureAcknowledgementPostIn,
    ProcedureAcknowledgementOut,
    ProcedureComplianceOut,
    ProcedureCompliancePatchIn,
    ProcedureLightCompletionPostIn,
    ProcedureLightCompletionStateOut,
    ProcedureLightCompletionStatusApi,
    ProcedureQuizStartOut,
    ProcedureQuizSubmitIn,
    ProcedureQuizSubmitOut,
    ProcedureSignoffOut,
    ProcedureSignoffPostIn,
    ProcedureVerificationStateOut,
    ProcedureVerificationViewPostIn,
)
from app.services.procedure_light_completion import get_light_completion_state, submit_light_procedure_completion
from app.schemas.maintenance_hub import (
    PreventativeRuleCreate,
    PreventativeRuleOut,
    PreventativeRuleUpdate,
    ProcedureCreate,
    ProcedureOut,
    ProcedureStepImageOut,
    ProcedureStepIn,
    ProcedureAssignmentCompleteOut,
    ProcedureAssignmentCreate,
    ProcedureAssignmentDetailOut,
    ProcedureAssignmentOut,
    ProcedureAssignmentPhotoOut,
    ProcedureUpdate,
    WorkOrderCreate,
    WorkOrderDetailOut,
    WorkOrderOut,
    WorkOrderUpdate,
    WorkOrderStatusApi,
    WorkOrderType,
    normalize_procedure_search_keywords,
    normalize_procedure_steps,
    parse_procedure_keyword_filter,
    procedure_row_matches_keyword_tokens,
    procedure_steps_to_storage,
)

router = APIRouter(prefix="/cmms", tags=["maintenance-hub"])

_MAX_STEP_IMAGE_BYTES = 5 * 1024 * 1024
_STEP_IMAGE_CT_EXT = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

_MAX_ASSIGN_PHOTO_BYTES = 8 * 1024 * 1024
_ASSIGN_PHOTO_CT_EXT = dict(_STEP_IMAGE_CT_EXT)


def _procedure_step_image_url(procedure_id: str, step_index: int) -> str:
    return f"/api/v1/cmms/procedures/{procedure_id}/steps/{step_index}/image"


def _procedure_assignment_photo_url(assignment_id: str, photo_id: str) -> str:
    return f"/api/v1/cmms/procedure-assignments/{assignment_id}/photos/{photo_id}"


def _assignment_row_to_out(a: PulseProcedureAssignment, proc: PulseProcedure) -> ProcedureAssignmentOut:
    return ProcedureAssignmentOut(
        id=str(a.id),
        company_id=str(a.company_id),
        procedure_id=str(a.procedure_id),
        procedure_title=str(proc.title),
        assigned_to_user_id=str(a.assigned_to_user_id),
        assigned_by_user_id=str(a.assigned_by_user_id) if a.assigned_by_user_id else None,
        kind=str(a.kind.value if hasattr(a.kind, "value") else a.kind),
        status=str(a.status.value if hasattr(a.status, "value") else a.status),
        notes=a.notes,
        due_at=a.due_at,
        completed_at=a.completed_at,
        created_at=a.created_at,
        updated_at=a.updated_at,
    )


async def _company_id(user: User = Depends(require_tenant_user)) -> str:
    if user.company_id is None:
        raise HTTPException(status_code=403, detail="Company context required")
    return str(user.company_id)


CompanyId = Annotated[str, Depends(_company_id)]
Db = Annotated[AsyncSession, Depends(get_db)]


def _asset_id_from_row(wr: PulseWorkRequest) -> Optional[str]:
    if wr.equipment_id:
        return str(wr.equipment_id)
    if wr.tool_id:
        return str(wr.tool_id)
    return None


def _apply_asset_id(wr: PulseWorkRequest, asset_id: Optional[str]) -> None:
    wr.equipment_id = None
    wr.tool_id = None
    if not asset_id:
        return
    # Prefer treating asset_id as facility equipment when it matches
    wr.equipment_id = asset_id


def _wo_status_str(s: PulseWorkRequestStatus) -> WorkOrderStatusApi:
    v = s.value if hasattr(s, "value") else str(s)
    if v in ("open", "in_progress", "hold", "completed", "cancelled"):
        return v  # type: ignore[return-value]
    return "open"


def _wo_type_str(t: PulseWorkOrderType) -> WorkOrderType:
    v = t.value if hasattr(t, "value") else str(t)
    if v in ("issue", "preventative", "request"):
        return v  # type: ignore[return-value]
    return "issue"


def _parse_wo_status(v: str) -> PulseWorkRequestStatus:
    try:
        return PulseWorkRequestStatus(v)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid status: {v}") from None


def row_to_work_order_out(wr: PulseWorkRequest) -> WorkOrderOut:
    src = wr.work_order_source.value if hasattr(wr.work_order_source, "value") else str(wr.work_order_source)
    return WorkOrderOut(
        id=str(wr.id),
        type=_wo_type_str(wr.work_order_type),
        title=wr.title,
        asset_id=_asset_id_from_row(wr),
        procedure_id=str(wr.procedure_id) if wr.procedure_id else None,
        status=_wo_status_str(wr.status),
        due_date=wr.due_date,
        created_at=wr.created_at,
        description=wr.description,
        zone_id=str(wr.zone_id) if wr.zone_id else None,
        equipment_id=str(wr.equipment_id) if wr.equipment_id else None,
        tool_id=str(wr.tool_id) if wr.tool_id else None,
        pm_task_id=str(wr.pm_task_id) if wr.pm_task_id else None,
        source=src if src in ("manual", "auto_pm", "downtime_detected") else "manual",
    )


def rule_to_out(r: PulsePreventativeRule) -> PreventativeRuleOut:
    return PreventativeRuleOut(
        id=str(r.id),
        company_id=str(r.company_id),
        asset_id=str(r.equipment_id),
        frequency=r.frequency,
        procedure_id=str(r.procedure_id) if r.procedure_id else None,
        created_at=r.created_at,
        updated_at=r.updated_at,
    )


# —— Work orders ——


@router.get("/work-orders", response_model=list[WorkOrderOut])
async def list_work_orders(
    db: Db,
    cid: CompanyId,
    type: Optional[str] = Query(None, description="issue | preventative | request"),
    limit: int = Query(100, ge=1, le=300),
    offset: int = Query(0, ge=0),
) -> list[WorkOrderOut]:
    conds = [PulseWorkRequest.company_id == cid]
    if type:
        try:
            conds.append(PulseWorkRequest.work_order_type == PulseWorkOrderType(type))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid type filter") from None
    q = (
        await db.execute(
            select(PulseWorkRequest)
            .where(and_(*conds))
            .order_by(PulseWorkRequest.updated_at.desc())
            .offset(offset)
            .limit(limit)
        )
    ).scalars().all()
    return [row_to_work_order_out(r) for r in q]


@router.get("/work-orders/{work_order_id}", response_model=WorkOrderDetailOut)
async def get_work_order(db: Db, cid: CompanyId, work_order_id: str) -> WorkOrderDetailOut:
    wr = await db.get(PulseWorkRequest, work_order_id)
    if not wr or wr.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    proc: ProcedureOut | None = None
    if wr.procedure_id:
        p = await db.get(PulseProcedure, wr.procedure_id)
        if p and p.company_id == cid:
            proc = ProcedureOut.model_validate(p)
    base = row_to_work_order_out(wr).model_dump()
    return WorkOrderDetailOut(**base, procedure=proc)


@router.post("/work-orders", response_model=WorkOrderOut, status_code=status.HTTP_201_CREATED)
async def create_work_order(
    db: Db,
    cid: CompanyId,
    body: WorkOrderCreate,
    user: User = Depends(require_tenant_user),
) -> WorkOrderOut:
    ot = PulseWorkOrderType(body.type)
    st = _parse_wo_status(body.status)
    wr = PulseWorkRequest(
        company_id=cid,
        title=body.title,
        description=body.description,
        zone_id=body.zone_id,
        work_order_type=ot,
        procedure_id=body.procedure_id,
        status=st,
        due_date=body.due_date,
        created_by_user_id=user.id,
        priority=PulseWorkRequestPriority.medium,
        attachments=[],
    )
    _apply_asset_id(wr, body.asset_id)
    if wr.equipment_id and not await pulse_svc.facility_equipment_in_company(db, cid, wr.equipment_id):
        raise HTTPException(status_code=400, detail="Unknown equipment for asset_id")
    if wr.zone_id:
        zq = await db.execute(select(Zone.id).where(Zone.id == wr.zone_id, Zone.company_id == cid))
        if zq.scalar_one_or_none() is None:
            raise HTTPException(status_code=400, detail="Unknown zone")
    if wr.procedure_id:
        pr = await db.get(PulseProcedure, wr.procedure_id)
        if not pr or pr.company_id != cid:
            raise HTTPException(status_code=400, detail="Unknown procedure")
    if st == PulseWorkRequestStatus.completed:
        wr.completed_at = datetime.now(timezone.utc)
    db.add(wr)
    await db.commit()
    await db.refresh(wr)
    return row_to_work_order_out(wr)


@router.patch("/work-orders/{work_order_id}", response_model=WorkOrderOut)
async def update_work_order(
    db: Db,
    cid: CompanyId,
    work_order_id: str,
    body: WorkOrderUpdate,
) -> WorkOrderOut:
    wr = await db.get(PulseWorkRequest, work_order_id)
    if not wr or wr.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    old_status = wr.status
    data = body.model_dump(exclude_unset=True)
    if "type" in data:
        wr.work_order_type = PulseWorkOrderType(data["type"])
    if "title" in data:
        wr.title = data["title"]
    if "description" in data:
        wr.description = data["description"]
    if "zone_id" in data:
        zid = data["zone_id"]
        if zid:
            zq = await db.execute(select(Zone.id).where(Zone.id == zid, Zone.company_id == cid))
            if zq.scalar_one_or_none() is None:
                raise HTTPException(status_code=400, detail="Unknown zone")
        wr.zone_id = zid
    if "asset_id" in data:
        _apply_asset_id(wr, data["asset_id"])
        if wr.equipment_id and not await pulse_svc.facility_equipment_in_company(db, cid, wr.equipment_id):
            raise HTTPException(status_code=400, detail="Unknown equipment for asset_id")
    if "procedure_id" in data:
        pid = data["procedure_id"]
        if pid:
            pr = await db.get(PulseProcedure, pid)
            if not pr or pr.company_id != cid:
                raise HTTPException(status_code=400, detail="Unknown procedure")
        wr.procedure_id = pid
    if "due_date" in data:
        wr.due_date = data["due_date"]
    if "status" in data:
        st = _parse_wo_status(data["status"])
        wr.status = st
        if st == PulseWorkRequestStatus.completed:
            wr.completed_at = datetime.now(timezone.utc)
        elif st != PulseWorkRequestStatus.completed:
            wr.completed_at = None
    if (
        "status" in data
        and wr.status == PulseWorkRequestStatus.completed
        and old_status != PulseWorkRequestStatus.completed
    ):
        await sync_pm_task_after_work_order_completed(db, wr)
    wr.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(wr)
    return row_to_work_order_out(wr)


@router.delete("/work-orders/{work_order_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_work_order(db: Db, cid: CompanyId, work_order_id: str) -> None:
    wr = await db.get(PulseWorkRequest, work_order_id)
    if not wr or wr.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    await db.execute(delete(PulseWorkRequest).where(PulseWorkRequest.id == wr.id))
    await db.commit()


# —— Procedures ——


@router.get("/procedures", response_model=list[ProcedureOut])
async def list_procedures(
    db: Db,
    cid: CompanyId,
    keyword: Optional[str] = Query(
        None,
        description="Comma-separated tokens; procedures whose internal keywords contain any token (case-insensitive).",
    ),
) -> list[ProcedureOut]:
    q = await db.execute(
        select(PulseProcedure).where(PulseProcedure.company_id == cid).order_by(PulseProcedure.title)
    )
    rows = list(q.scalars().all())
    tokens = parse_procedure_keyword_filter(keyword)
    if tokens:
        rows = [r for r in rows if procedure_row_matches_keyword_tokens(getattr(r, "search_keywords", None), tokens)]
    return [ProcedureOut.model_validate(r) for r in rows]


@router.post("/procedures", response_model=ProcedureOut, status_code=status.HTTP_201_CREATED)
async def create_procedure(
    db: Db, cid: CompanyId, body: ProcedureCreate, user: Annotated[User, Depends(require_tenant_user)]
) -> ProcedureOut:
    payload = procedure_steps_to_storage(body.steps) if body.steps else []
    kw = normalize_procedure_search_keywords(body.search_keywords)
    row = PulseProcedure(
        company_id=cid,
        title=body.title.strip(),
        steps=payload,
        search_keywords=kw,
        created_by_user_id=body.created_by_user_id or str(user.id),
        created_by_name=(body.created_by_name or "").strip() or (str(user.full_name or "").strip() or str(user.email)),
        review_required=bool(body.review_required),
        is_critical=bool(body.is_critical),
        published_at=body.published_at,
        revision_notes=(str(body.revision_notes).strip() if body.revision_notes else None),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return ProcedureOut.model_validate(row)


@router.get("/procedures/{procedure_id}", response_model=ProcedureOut)
async def get_procedure(db: Db, cid: CompanyId, procedure_id: str) -> ProcedureOut:
    row = await db.get(PulseProcedure, procedure_id)
    if not row or row.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    return ProcedureOut.model_validate(row)


@router.get("/procedures/{procedure_id}/compliance", response_model=ProcedureComplianceOut)
async def get_procedure_compliance(
    procedure_id: str,
    db: Db,
    cid: CompanyId,
    _: Annotated[User, Depends(require_tenant_user)],
) -> ProcedureComplianceOut:
    row = await db.get(PulseProcedure, procedure_id)
    if not row or row.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    cs = await db.get(PulseProcedureComplianceSettings, procedure_id)
    now = datetime.now(timezone.utc)
    baseline = row.updated_at or now
    if cs is None:
        return ProcedureComplianceOut(
            procedure_id=str(row.id),
            company_id=str(row.company_id),
            tier="general",
            due_within_days=None,
            requires_acknowledgement=False,
            requires_knowledge_verification=True,
            updated_at=baseline,
            updated_by_user_id=None,
        )
    return ProcedureComplianceOut(
        procedure_id=str(cs.procedure_id),
        company_id=str(cs.company_id),
        tier=str(cs.tier),  # type: ignore[arg-type]
        due_within_days=cs.due_within_days,
        requires_acknowledgement=bool(cs.requires_acknowledgement),
        requires_knowledge_verification=bool(getattr(cs, "requires_knowledge_verification", True)),
        updated_at=cs.updated_at,
        updated_by_user_id=str(cs.updated_by_user_id) if cs.updated_by_user_id else None,
    )


@router.patch("/procedures/{procedure_id}/compliance", response_model=ProcedureComplianceOut)
async def patch_procedure_compliance(
    procedure_id: str,
    db: Db,
    cid: CompanyId,
    body: ProcedureCompliancePatchIn,
    user: Annotated[User, Depends(require_training_matrix_access)],
) -> ProcedureComplianceOut:
    row = await db.get(PulseProcedure, procedure_id)
    if not row or row.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    now = datetime.now(timezone.utc)
    cs = await db.get(PulseProcedureComplianceSettings, procedure_id)
    if cs is None:
        cs = PulseProcedureComplianceSettings(
            procedure_id=str(row.id),
            company_id=str(row.company_id),
            tier=str(body.tier),
            due_within_days=body.due_within_days,
            requires_acknowledgement=bool(body.requires_acknowledgement),
            requires_knowledge_verification=bool(body.requires_knowledge_verification)
            if body.requires_knowledge_verification is not None
            else True,
            updated_at=now,
            updated_by_user_id=str(user.id),
        )
        db.add(cs)
    else:
        cs.tier = str(body.tier)
        cs.due_within_days = body.due_within_days
        cs.requires_acknowledgement = bool(body.requires_acknowledgement)
        if body.requires_knowledge_verification is not None:
            cs.requires_knowledge_verification = bool(body.requires_knowledge_verification)
        cs.updated_at = now
        cs.updated_by_user_id = str(user.id)
    await db.commit()
    await db.refresh(cs)
    return ProcedureComplianceOut(
        procedure_id=str(cs.procedure_id),
        company_id=str(cs.company_id),
        tier=str(cs.tier),  # type: ignore[arg-type]
        due_within_days=cs.due_within_days,
        requires_acknowledgement=bool(cs.requires_acknowledgement),
        requires_knowledge_verification=bool(getattr(cs, "requires_knowledge_verification", True)),
        updated_at=cs.updated_at,
        updated_by_user_id=str(cs.updated_by_user_id) if cs.updated_by_user_id else None,
    )


@router.get("/procedures/{procedure_id}/verification/state", response_model=ProcedureVerificationStateOut)
async def get_procedure_verification_state(
    procedure_id: str,
    db: Db,
    cid: CompanyId,
    actor: Annotated[User, Depends(require_tenant_user)],
) -> ProcedureVerificationStateOut:
    proc = await db.get(PulseProcedure, procedure_id)
    if not proc or proc.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    if not await pulse_svc._user_in_company(db, cid, str(actor.id)):
        raise HTTPException(status_code=400, detail="Unknown user")
    cs = await db.get(PulseProcedureComplianceSettings, procedure_id)
    rev = int(proc.content_revision or 1)
    vreq = verification_requires_quiz(cs)
    snap = await get_engagement_snapshot(db, cid, str(actor.id), procedure_id, rev)
    ack_map = await latest_ack_revision_map(db, cid, [str(actor.id)], [procedure_id])
    latest_ack = ack_map.get((str(actor.id), procedure_id))
    acknowledged_for_revision = latest_ack is not None and latest_ack >= rev
    tier, _, _ = resolve_compliance_defaults(cs)
    stats = await load_attempt_stats_for_pairs(db, cid, [str(actor.id)], [procedure_id], {procedure_id: rev})
    st = stats.get((str(actor.id), procedure_id), QuizAttemptStats(0, None, None))
    can_ack = bool(vreq and snap.first_viewed_at is not None and not acknowledged_for_revision)
    can_quiz = bool(vreq and acknowledged_for_revision and snap.quiz_passed_at is None)
    ack_row_q = await db.execute(
        select(PulseProcedureTrainingAcknowledgement).where(
            PulseProcedureTrainingAcknowledgement.company_id == cid,
            PulseProcedureTrainingAcknowledgement.employee_user_id == str(actor.id),
            PulseProcedureTrainingAcknowledgement.procedure_id == procedure_id,
            PulseProcedureTrainingAcknowledgement.revision_number == rev,
        )
    )
    ack_for_rev = ack_row_q.scalar_one_or_none()
    acknowledgement_at = ack_for_rev.acknowledged_at if ack_for_rev else None
    return ProcedureVerificationStateOut(
        revision_number=rev,
        verification_required=vreq,
        first_viewed_at=snap.first_viewed_at,
        last_viewed_at=snap.last_viewed_at,
        total_view_seconds=snap.total_view_seconds,
        quiz_passed_at=snap.quiz_passed_at,
        acknowledged_for_revision=acknowledged_for_revision,
        acknowledgement_at=acknowledgement_at,
        quiz_attempt_count=st.attempt_count,
        quiz_latest_score_percent=st.latest_score_percent,
        can_acknowledge=can_ack,
        can_start_quiz=can_quiz,
    )


@router.post("/procedures/{procedure_id}/verification/view", status_code=status.HTTP_204_NO_CONTENT)
async def post_procedure_verification_view(
    procedure_id: str,
    db: Db,
    cid: CompanyId,
    actor: Annotated[User, Depends(require_tenant_user)],
    body: ProcedureVerificationViewPostIn = Body(default_factory=ProcedureVerificationViewPostIn),
) -> Response:
    proc = await db.get(PulseProcedure, procedure_id)
    if not proc or proc.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    rev = int(proc.content_revision or 1)
    await record_engagement_view(
        db,
        cid,
        str(actor.id),
        procedure_id,
        rev,
        delta_seconds=body.accumulated_seconds,
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/procedures/{procedure_id}/verification/quiz/start", response_model=ProcedureQuizStartOut)
async def post_procedure_verification_quiz_start(
    procedure_id: str,
    db: Db,
    cid: CompanyId,
    actor: Annotated[User, Depends(require_tenant_user)],
) -> ProcedureQuizStartOut:
    proc = await db.get(PulseProcedure, procedure_id)
    if not proc or proc.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    cs = await db.get(PulseProcedureComplianceSettings, procedure_id)
    if not verification_requires_quiz(cs):
        raise HTTPException(status_code=400, detail="Knowledge verification is disabled for this procedure")
    rev = int(proc.content_revision or 1)
    ack_map = await latest_ack_revision_map(db, cid, [str(actor.id)], [procedure_id])
    latest_ack = ack_map.get((str(actor.id), procedure_id))
    if latest_ack is None or latest_ack < rev:
        raise HTTPException(status_code=400, detail="Acknowledge the procedure before starting verification")
    tier, _, _ = resolve_compliance_defaults(cs)
    sid, qs = await create_quiz_session_for_employee(db, cid, str(actor.id), proc, tier=str(tier))
    await db.commit()
    return ProcedureQuizStartOut(session_id=sid, questions=qs)


@router.post("/procedures/{procedure_id}/verification/quiz/submit", response_model=ProcedureQuizSubmitOut)
async def post_procedure_verification_quiz_submit(
    procedure_id: str,
    db: Db,
    cid: CompanyId,
    actor: Annotated[User, Depends(require_tenant_user)],
    body: ProcedureQuizSubmitIn,
) -> ProcedureQuizSubmitOut:
    proc = await db.get(PulseProcedure, procedure_id)
    if not proc or proc.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    cs = await db.get(PulseProcedureComplianceSettings, procedure_id)
    tier, _, _ = resolve_compliance_defaults(cs)
    sup = user_has_any_role(actor, UserRole.supervisor, UserRole.manager, UserRole.company_admin)
    try:
        result = await complete_verification_quiz_session(
            db,
            cid,
            str(actor.id),
            proc,
            session_id=body.session_id,
            answers=body.answers,
            tier=str(tier),
            completed_by_user_id=str(actor.id),
            supervisor_signoff=bool(sup),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    await db.commit()
    if result.get("passed"):
        await event_engine.publish(
            DomainEvent(
                event_type="ops.procedure_completed",
                company_id=str(cid),
                entity_id=str(proc.id),
                source_module="cmms",
                metadata={
                    "procedure_id": str(proc.id),
                    "completed_by": str(actor.id),
                    "verification_quiz": True,
                    "all_steps_completed": False,
                },
            )
        )
    return ProcedureQuizSubmitOut(
        score_percent=int(result["score_percent"]),
        correct_count=int(result["correct_count"]),
        total_questions=int(result["total_questions"]),
        passed=bool(result["passed"]),
        reveal=dict(result.get("reveal") or {}),
        completion_id=result.get("completion_id"),
        completion_created=bool(result.get("completion_created")),
    )


@router.post("/procedures/{procedure_id}/sign-off", response_model=ProcedureSignoffOut)
async def post_procedure_training_sign_off(
    procedure_id: str,
    db: Db,
    cid: CompanyId,
    body: ProcedureSignoffPostIn,
    actor: Annotated[User, Depends(require_tenant_user)],
) -> ProcedureSignoffOut:
    proc = await db.get(PulseProcedure, procedure_id)
    if not proc or proc.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    target_employee_id = body.employee_id if body.employee_id else str(actor.id)
    if target_employee_id != str(actor.id):
        ok = (
            user_has_tenant_full_admin(actor)
            or user_has_any_role(actor, UserRole.company_admin, UserRole.manager, UserRole.supervisor)
        )
        if not ok:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Managers or supervisors only")
        if not await pulse_svc._user_in_company(db, cid, target_employee_id):
            raise HTTPException(status_code=400, detail="Unknown employee_id")
    else:
        if not await pulse_svc._user_in_company(db, cid, target_employee_id):
            raise HTTPException(status_code=400, detail="Unknown employee")

    marker = (
        body.revision_marker.strip()
        if body.revision_marker and str(body.revision_marker).strip()
        else revision_marker_from_procedure(proc)
    )
    if marker != revision_marker_from_procedure(proc):
        raise HTTPException(status_code=409, detail="revision_marker does not match current procedure revision")

    cs_row = await db.get(PulseProcedureComplianceSettings, procedure_id)
    if verification_requires_quiz(cs_row):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Knowledge verification is required — complete the acknowledgment and quiz instead of legacy sign-off.",
        )

    row, created = await record_procedure_signoff(
        db,
        cid,
        employee_user_id=str(target_employee_id),
        procedure=proc,
        completed_by_user_id=str(actor.id),
        supervisor_signoff=bool(body.supervisor_signoff),
        revision_marker=marker,
    )
    await db.commit()
    await event_engine.publish(
        DomainEvent(
            event_type="ops.procedure_completed",
            company_id=str(cid),
            entity_id=str(proc.id),
            source_module="cmms",
            metadata={
                "procedure_id": str(proc.id),
                "completed_by": str(actor.id),
                "verification_quiz": False,
                "all_steps_completed": False,
            },
        )
    )
    return ProcedureSignoffOut(
        id=str(row.id),
        revision_marker=str(row.revision_marker),
        created=created,
        completed_at=row.completed_at,
    )


@router.post("/procedures/{procedure_id}/acknowledgement", response_model=ProcedureAcknowledgementOut)
async def post_procedure_training_acknowledgement(
    procedure_id: str,
    db: Db,
    cid: CompanyId,
    actor: Annotated[User, Depends(require_tenant_user)],
    body: ProcedureAcknowledgementPostIn = Body(default_factory=ProcedureAcknowledgementPostIn),
) -> ProcedureAcknowledgementOut:
    proc = await db.get(PulseProcedure, procedure_id)
    if not proc or proc.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    target_employee_id = body.employee_id if body.employee_id else str(actor.id)
    if target_employee_id != str(actor.id):
        ok = (
            user_has_tenant_full_admin(actor)
            or user_has_any_role(actor, UserRole.company_admin, UserRole.manager, UserRole.supervisor)
        )
        if not ok:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Managers or supervisors only")
        if not await pulse_svc._user_in_company(db, cid, target_employee_id):
            raise HTTPException(status_code=400, detail="Unknown employee_id")
    else:
        if not await pulse_svc._user_in_company(db, cid, target_employee_id):
            raise HTTPException(status_code=400, detail="Unknown employee")

    cs_ack = await db.get(PulseProcedureComplianceSettings, procedure_id)
    if verification_requires_quiz(cs_ack):
        if not body.read_understood_confirmed:
            raise HTTPException(
                status_code=400,
                detail="Confirm read and understood (read_understood_confirmed) before acknowledging.",
            )
        rev_n = int(proc.content_revision or 1)
        snap = await get_engagement_snapshot(db, cid, str(target_employee_id), procedure_id, rev_n)
        if snap.first_viewed_at is None:
            raise HTTPException(
                status_code=400,
                detail="Review the procedure content before acknowledging.",
            )

    ak, _ = await record_procedure_acknowledgement(
        db,
        cid,
        employee_user_id=str(target_employee_id),
        procedure=proc,
    )
    await db.commit()
    return ProcedureAcknowledgementOut(
        revision_number=int(ak.revision_number),
        acknowledged_at=ak.acknowledged_at,
    )


def _light_completion_state_out(
    proc: PulseProcedure,
    st: ProcedureLightCompletionStatusApi,
    row: Optional[PulseProcedureWorkerCompletion],
) -> ProcedureLightCompletionStateOut:
    rev = int(proc.content_revision or 1)
    if row is None:
        return ProcedureLightCompletionStateOut(status=st, current_revision_number=rev)
    return ProcedureLightCompletionStateOut(
        status=st,
        current_revision_number=rev,
        completed_at=row.completed_at,
        completed_revision_number=int(row.revision_number),
        expires_at=row.expires_at,
        primary_acknowledged_at=row.primary_acknowledged_at,
        secondary_acknowledged_at=row.secondary_acknowledged_at,
        quiz_score_percent=row.quiz_score_percent,
    )


@router.get("/procedures/{procedure_id}/light-completion", response_model=ProcedureLightCompletionStateOut)
async def get_procedure_light_completion(
    procedure_id: str,
    db: Db,
    cid: CompanyId,
    actor: Annotated[User, Depends(require_tenant_user)],
) -> ProcedureLightCompletionStateOut:
    proc = await db.get(PulseProcedure, procedure_id)
    if not proc or proc.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    if not await pulse_svc._user_in_company(db, cid, str(actor.id)):
        raise HTTPException(status_code=400, detail="Unknown user")
    st, row = await get_light_completion_state(db, cid, employee_user_id=str(actor.id), procedure=proc)
    return _light_completion_state_out(proc, st, row)


@router.post("/procedures/{procedure_id}/light-completion", response_model=ProcedureLightCompletionStateOut)
async def post_procedure_light_completion(
    procedure_id: str,
    db: Db,
    cid: CompanyId,
    actor: Annotated[User, Depends(require_tenant_user)],
    body: ProcedureLightCompletionPostIn,
) -> ProcedureLightCompletionStateOut:
    proc = await db.get(PulseProcedure, procedure_id)
    if not proc or proc.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    if not await pulse_svc._user_in_company(db, cid, str(actor.id)):
        raise HTTPException(status_code=400, detail="Unknown user")
    cs = await db.get(PulseProcedureComplianceSettings, procedure_id)
    supervisor_signoff = bool(
        user_has_tenant_full_admin(actor)
        or user_has_any_role(actor, UserRole.company_admin, UserRole.manager, UserRole.supervisor)
    )
    try:
        await submit_light_procedure_completion(
            db,
            cid,
            employee_user_id=str(actor.id),
            procedure=proc,
            cs=cs,
            completed_by_user_id=str(actor.id),
            primary_acknowledged=bool(body.primary_acknowledged),
            secondary_acknowledged=bool(body.secondary_acknowledged),
            supervisor_signoff=supervisor_signoff,
        )
        await db.commit()
    except ValueError as e:
        await db.rollback()
        msg = str(e)
        if "Already completed" in msg:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=msg) from e
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg) from e
    else:
        await event_engine.publish(
            DomainEvent(
                event_type="ops.procedure_completed",
                company_id=str(cid),
                entity_id=str(proc.id),
                source_module="cmms",
                metadata={
                    "procedure_id": str(proc.id),
                    "completed_by": str(actor.id),
                    "verification_quiz": False,
                    "light_completion": True,
                    "all_steps_completed": False,
                },
            )
        )
    st, row = await get_light_completion_state(db, cid, employee_user_id=str(actor.id), procedure=proc)
    return _light_completion_state_out(proc, st, row)


@router.patch("/procedures/{procedure_id}", response_model=ProcedureOut)
async def update_procedure(
    db: Db,
    cid: CompanyId,
    procedure_id: str,
    body: ProcedureUpdate,
    user: Annotated[User, Depends(require_tenant_user)],
) -> ProcedureOut:
    row = await db.get(PulseProcedure, procedure_id)
    if not row or row.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    patch = body.model_dump(exclude_unset=True)
    mutated = False
    if "title" in patch and patch["title"] is not None:
        row.title = patch["title"].strip()
        mutated = True
    if "steps" in patch and patch["steps"] is not None:
        raw_steps = patch["steps"]
        parsed = [ProcedureStepIn.model_validate(s) for s in raw_steps]
        row.steps = procedure_steps_to_storage(parsed)
        mutated = True
    if "search_keywords" in patch:
        row.search_keywords = normalize_procedure_search_keywords(patch.get("search_keywords"))
        mutated = True
    if "created_by_user_id" in patch:
        row.created_by_user_id = patch["created_by_user_id"]
    if "created_by_name" in patch:
        cn = patch["created_by_name"]
        row.created_by_name = None if cn is None else (str(cn).strip() or None)
    if "review_required" in patch and patch["review_required"] is not None:
        row.review_required = bool(patch["review_required"])
    if "reviewed_by_user_id" in patch:
        row.reviewed_by_user_id = patch["reviewed_by_user_id"]
    if "reviewed_by_name" in patch:
        rn = patch["reviewed_by_name"]
        row.reviewed_by_name = None if rn is None else (str(rn).strip() or None)
    if "reviewed_at" in patch:
        row.reviewed_at = patch["reviewed_at"]
    if "is_critical" in patch and patch["is_critical"] is not None:
        row.is_critical = bool(patch["is_critical"])
    if "published_at" in patch:
        row.published_at = patch.get("published_at")
    if "revision_notes" in patch:
        rn_meta = patch.get("revision_notes")
        row.revision_notes = None if rn_meta is None else (str(rn_meta).strip() or None)
    if mutated:
        row.revised_by_user_id = patch.get("revised_by_user_id") or str(user.id)
        rn = patch.get("revised_by_name") or (str(user.full_name or "").strip() or str(user.email))
        row.revised_by_name = (str(rn).strip() or None) if rn is not None else None
        row.revised_at = patch.get("revised_at") or datetime.now(timezone.utc)
        row.content_revision = int(row.content_revision or 1) + 1
    row.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(row)
    return ProcedureOut.model_validate(row)


@router.get("/procedures/{procedure_id}/steps/{step_index}/image")
async def get_procedure_step_image(
    procedure_id: str,
    step_index: int,
    db: Db,
    cid: CompanyId,
) -> Response:
    row = await db.get(PulseProcedure, procedure_id)
    if not row or row.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    blob = await read_procedure_step_image_bytes(cid, procedure_id, step_index)
    if not blob:
        raise HTTPException(status_code=404, detail="No image for this step")
    data, media_type = blob
    return Response(content=data, media_type=media_type)


@router.post(
    "/procedures/{procedure_id}/steps/{step_index}/image",
    response_model=ProcedureStepImageOut,
)
async def upload_procedure_step_image(
    procedure_id: str,
    step_index: int,
    db: Db,
    cid: CompanyId,
    file: UploadFile = File(...),
) -> ProcedureStepImageOut:
    if step_index < 0 or step_index > 200:
        raise HTTPException(status_code=400, detail="Invalid step index")
    row = await db.get(PulseProcedure, procedure_id)
    if not row or row.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    steps_list = normalize_procedure_steps(row.steps)
    if step_index >= len(steps_list):
        raise HTTPException(
            status_code=400,
            detail="Step index out of range — save procedure steps first",
        )
    ct = (file.content_type or "").split(";")[0].strip().lower()
    if ct not in _STEP_IMAGE_CT_EXT:
        raise HTTPException(status_code=400, detail="Upload a JPEG, PNG, or WebP image (max 5MB)")
    raw = await file.read()
    if len(raw) > _MAX_STEP_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="Image too large (max 5MB)")
    ext = _STEP_IMAGE_CT_EXT[ct]
    try:
        await write_procedure_step_image_bytes(cid, procedure_id, step_index, ext, raw, ct)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    url = _procedure_step_image_url(procedure_id, step_index)
    as_dict = [s.model_dump() for s in steps_list]
    as_dict[step_index]["image_url"] = url
    row.steps = as_dict
    row.updated_at = datetime.now(timezone.utc)
    row.content_revision = int(row.content_revision or 1) + 1
    await db.commit()
    await db.refresh(row)
    return ProcedureStepImageOut(image_url=url)


@router.delete("/procedures/{procedure_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_procedure(db: Db, cid: CompanyId, procedure_id: str) -> None:
    row = await db.get(PulseProcedure, procedure_id)
    if not row or row.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    await db.execute(delete(PulseProcedure).where(PulseProcedure.id == row.id))
    await db.commit()


# —— Procedure assignments (mobile completion) ——


@router.post("/procedure-assignments", response_model=ProcedureAssignmentOut, status_code=status.HTTP_201_CREATED)
async def create_procedure_assignment(
    body: ProcedureAssignmentCreate,
    db: Db,
    cid: CompanyId,
    user: Annotated[User, Depends(require_tenant_user)],
) -> ProcedureAssignmentOut:
    proc = await db.get(PulseProcedure, body.procedure_id)
    if not proc or proc.company_id != cid:
        raise HTTPException(status_code=400, detail="Unknown procedure")
    if not await pulse_svc._user_in_company(db, cid, body.assigned_to_user_id):
        raise HTTPException(status_code=400, detail="Unknown assigned_to_user_id")
    kind_raw = str(body.kind).strip().lower()
    if kind_raw not in ("complete", "revise", "create"):
        raise HTTPException(status_code=400, detail="Invalid assignment kind")
    row = PulseProcedureAssignment(
        company_id=cid,
        procedure_id=str(proc.id),
        assigned_to_user_id=str(body.assigned_to_user_id),
        assigned_by_user_id=str(user.id),
        kind=PulseProcedureAssignmentKind(kind_raw),
        status=PulseProcedureAssignmentStatus.pending,
        notes=(body.notes or "").strip() or None,
        due_at=body.due_at,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return _assignment_row_to_out(row, proc)


@router.get("/procedure-assignments/my", response_model=list[ProcedureAssignmentOut])
async def list_my_procedure_assignments(
    db: Db,
    cid: CompanyId,
    user: Annotated[User, Depends(require_tenant_user)],
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(200, ge=1, le=500),
) -> list[ProcedureAssignmentOut]:
    stmt = (
        select(PulseProcedureAssignment, PulseProcedure)
        .join(PulseProcedure, PulseProcedureAssignment.procedure_id == PulseProcedure.id)
        .where(
            PulseProcedureAssignment.company_id == cid,
            PulseProcedureAssignment.assigned_to_user_id == str(user.id),
        )
        .order_by(PulseProcedureAssignment.created_at.desc())
        .limit(limit)
    )
    if status_filter:
        sf = str(status_filter).strip().lower()
        if sf in ("pending", "in_progress", "completed"):
            stmt = stmt.where(PulseProcedureAssignment.status == sf)
    q = await db.execute(stmt)
    rows = q.all()
    return [_assignment_row_to_out(a, p) for (a, p) in rows]


@router.get("/procedure-assignments/{assignment_id}", response_model=ProcedureAssignmentDetailOut)
async def get_procedure_assignment(
    assignment_id: str,
    db: Db,
    cid: CompanyId,
    user: Annotated[User, Depends(require_tenant_user)],
) -> ProcedureAssignmentDetailOut:
    q = await db.execute(
        select(PulseProcedureAssignment, PulseProcedure)
        .join(PulseProcedure, PulseProcedureAssignment.procedure_id == PulseProcedure.id)
        .where(PulseProcedureAssignment.id == assignment_id, PulseProcedureAssignment.company_id == cid)
        .limit(1)
    )
    row = q.first()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    a, proc = row
    if str(a.assigned_to_user_id) != str(user.id) and str(a.assigned_by_user_id) != str(user.id):
        # MVP: only assignee or assigner can view. Elevated checks can be added later.
        raise HTTPException(status_code=403, detail="Not your assignment")
    pq = await db.execute(
        select(PulseProcedureAssignmentPhoto)
        .where(
            PulseProcedureAssignmentPhoto.company_id == cid,
            PulseProcedureAssignmentPhoto.assignment_id == assignment_id,
        )
        .order_by(PulseProcedureAssignmentPhoto.created_at.desc())
        .limit(200)
    )
    photos = pq.scalars().all()
    out = _assignment_row_to_out(a, proc)
    return ProcedureAssignmentDetailOut(
        **out.model_dump(),
        procedure=ProcedureOut.model_validate(proc),
        photos=[
            ProcedureAssignmentPhotoOut(
                id=str(ph.id),
                url=_procedure_assignment_photo_url(assignment_id, str(ph.id)),
                created_at=ph.created_at,
            )
            for ph in photos
        ],
    )


@router.get("/procedure-assignments/{assignment_id}/photos/{photo_id}")
async def get_procedure_assignment_photo(
    assignment_id: str,
    photo_id: str,
    db: Db,
    cid: CompanyId,
    user: Annotated[User, Depends(require_tenant_user)],
) -> Response:
    aq = await db.execute(
        select(PulseProcedureAssignment).where(
            PulseProcedureAssignment.id == assignment_id,
            PulseProcedureAssignment.company_id == cid,
        )
    )
    a = aq.scalar_one_or_none()
    if a is None:
        raise HTTPException(status_code=404, detail="Not found")
    if str(a.assigned_to_user_id) != str(user.id) and str(a.assigned_by_user_id) != str(user.id):
        raise HTTPException(status_code=403, detail="Not your assignment")
    blob = await read_procedure_assignment_photo_bytes(cid, assignment_id, photo_id)
    if not blob:
        raise HTTPException(status_code=404, detail="No photo")
    data, media_type = blob
    return Response(content=data, media_type=media_type)


@router.post(
    "/procedure-assignments/{assignment_id}/photos",
    response_model=ProcedureAssignmentPhotoOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_procedure_assignment_photo(
    assignment_id: str,
    db: Db,
    cid: CompanyId,
    user: Annotated[User, Depends(require_tenant_user)],
    file: UploadFile = File(...),
) -> ProcedureAssignmentPhotoOut:
    aq = await db.execute(
        select(PulseProcedureAssignment).where(
            PulseProcedureAssignment.id == assignment_id,
            PulseProcedureAssignment.company_id == cid,
        )
    )
    a = aq.scalar_one_or_none()
    if a is None:
        raise HTTPException(status_code=404, detail="Not found")
    if str(a.assigned_to_user_id) != str(user.id):
        raise HTTPException(status_code=403, detail="Only assignee can upload photos")

    ct = (file.content_type or "").split(";")[0].strip().lower()
    if ct not in _ASSIGN_PHOTO_CT_EXT:
        raise HTTPException(status_code=400, detail="Upload a JPEG, PNG, or WebP image (max 8MB)")
    raw = await file.read()
    if len(raw) > _MAX_ASSIGN_PHOTO_BYTES:
        raise HTTPException(status_code=400, detail="Image too large (max 8MB)")

    ext = _ASSIGN_PHOTO_CT_EXT[ct]
    photo_id = str(uuid4())
    try:
        path = await write_procedure_assignment_photo_bytes(cid, assignment_id, photo_id, ext, raw, ct)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e

    ph = PulseProcedureAssignmentPhoto(
        id=photo_id,
        company_id=cid,
        assignment_id=assignment_id,
        uploaded_by_user_id=str(user.id),
        photo_path=path,
        content_type=ct,
    )
    db.add(ph)
    if a.status == PulseProcedureAssignmentStatus.pending:
        a.status = PulseProcedureAssignmentStatus.in_progress
    a.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(ph)
    return ProcedureAssignmentPhotoOut(id=str(ph.id), url=_procedure_assignment_photo_url(assignment_id, str(ph.id)), created_at=ph.created_at)


@router.post("/procedure-assignments/{assignment_id}/complete", response_model=ProcedureAssignmentCompleteOut)
async def complete_procedure_assignment(
    assignment_id: str,
    db: Db,
    cid: CompanyId,
    user: Annotated[User, Depends(require_tenant_user)],
) -> ProcedureAssignmentCompleteOut:
    aq = await db.execute(
        select(PulseProcedureAssignment).where(
            PulseProcedureAssignment.id == assignment_id,
            PulseProcedureAssignment.company_id == cid,
        )
    )
    a = aq.scalar_one_or_none()
    if a is None:
        raise HTTPException(status_code=404, detail="Not found")
    if str(a.assigned_to_user_id) != str(user.id):
        raise HTTPException(status_code=403, detail="Only assignee can complete")
    a.status = PulseProcedureAssignmentStatus.completed
    now = datetime.now(timezone.utc)
    a.completed_at = now
    a.updated_at = now
    proc = await db.get(PulseProcedure, a.procedure_id)
    steps_n = len(normalize_procedure_steps(proc.steps if proc else None))
    photo_n = int(
        (
            await db.execute(
                select(func.count()).select_from(PulseProcedureAssignmentPhoto).where(
                    PulseProcedureAssignmentPhoto.assignment_id == assignment_id
                )
            )
        ).scalar_one()
        or 0
    )
    all_steps_completed = steps_n == 0 or (steps_n > 0 and photo_n >= steps_n)
    await db.commit()
    await event_engine.publish(
        DomainEvent(
            event_type="ops.procedure_completed",
            company_id=str(cid),
            entity_id=str(a.procedure_id),
            source_module="cmms",
            metadata={
                "procedure_id": str(a.procedure_id),
                "completed_by": str(user.id),
                "assignment_id": str(a.id),
                "all_steps_completed": all_steps_completed,
            },
        )
    )
    return ProcedureAssignmentCompleteOut(assignment_id=str(a.id), completed_at=now)


# —— Preventative ——


@router.get("/preventative", response_model=list[PreventativeRuleOut])
async def list_preventative(db: Db, cid: CompanyId) -> list[PreventativeRuleOut]:
    q = await db.execute(
        select(PulsePreventativeRule)
        .where(PulsePreventativeRule.company_id == cid)
        .order_by(PulsePreventativeRule.updated_at.desc())
    )
    return [rule_to_out(r) for r in q.scalars().all()]


@router.post("/preventative", response_model=PreventativeRuleOut, status_code=status.HTTP_201_CREATED)
async def create_preventative(db: Db, cid: CompanyId, body: PreventativeRuleCreate) -> PreventativeRuleOut:
    raise HTTPException(
        status_code=410,
        detail="Preventative rules are deprecated. Use PM tasks (pm_tasks) instead.",
    )
    if not await pulse_svc.facility_equipment_in_company(db, cid, body.asset_id):
        raise HTTPException(status_code=400, detail="Unknown asset_id (equipment)")
    if body.procedure_id:
        pr = await db.get(PulseProcedure, body.procedure_id)
        if not pr or pr.company_id != cid:
            raise HTTPException(status_code=400, detail="Unknown procedure")
    row = PulsePreventativeRule(
        company_id=cid,
        equipment_id=body.asset_id,
        frequency=body.frequency.strip(),
        procedure_id=body.procedure_id,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return rule_to_out(row)


@router.get("/preventative/{rule_id}", response_model=PreventativeRuleOut)
async def get_preventative(db: Db, cid: CompanyId, rule_id: str) -> PreventativeRuleOut:
    row = await db.get(PulsePreventativeRule, rule_id)
    if not row or row.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    return rule_to_out(row)


@router.patch("/preventative/{rule_id}", response_model=PreventativeRuleOut)
async def update_preventative(
    db: Db, cid: CompanyId, rule_id: str, body: PreventativeRuleUpdate
) -> PreventativeRuleOut:
    raise HTTPException(
        status_code=410,
        detail="Preventative rules are deprecated. Use PM tasks (pm_tasks) instead.",
    )
    row = await db.get(PulsePreventativeRule, rule_id)
    if not row or row.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    if body.asset_id is not None:
        if not await pulse_svc.facility_equipment_in_company(db, cid, body.asset_id):
            raise HTTPException(status_code=400, detail="Unknown asset_id")
        row.equipment_id = body.asset_id
    if body.frequency is not None:
        row.frequency = body.frequency.strip()
    if body.procedure_id is not None:
        if body.procedure_id:
            pr = await db.get(PulseProcedure, body.procedure_id)
            if not pr or pr.company_id != cid:
                raise HTTPException(status_code=400, detail="Unknown procedure")
        row.procedure_id = body.procedure_id
    row.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(row)
    return rule_to_out(row)


@router.delete("/preventative/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_preventative(db: Db, cid: CompanyId, rule_id: str) -> None:
    raise HTTPException(
        status_code=410,
        detail="Preventative rules are deprecated. Use PM tasks (pm_tasks) instead.",
    )
    row = await db.get(PulsePreventativeRule, rule_id)
    if not row or row.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    await db.execute(delete(PulsePreventativeRule).where(PulsePreventativeRule.id == row.id))
    await db.commit()
