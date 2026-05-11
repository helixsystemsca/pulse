"""Operational XP: recognitions and tenant-level operator configuration."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_tenant_user
from app.core.database import get_db
from app.core.user_roles import user_has_any_role
from app.models.domain import User, UserRole
from app.models.gamification_models import PulseWorkerRecognition, PulseXpOperatorConfig, UserStats
from app.models.pulse_models import PulseWorkerHR
from app.schemas.operational_xp import (
    RECOGNITION_XP,
    OperationalXpConfigOut,
    OperationalXpConfigPatchIn,
    RecognitionApproveIn,
    RecognitionCreateIn,
    RecognitionOut,
)
from app.services.operational_xp_award import award_operational_xp

router = APIRouter(prefix="/operations/xp", tags=["operational-xp"])

Db = Annotated[AsyncSession, Depends(get_db)]


async def _company_id(user: User = Depends(require_tenant_user)) -> str:
    assert user.company_id is not None
    return str(user.company_id)


CompanyId = Annotated[str, Depends(_company_id)]


def _cfg_out(row: PulseXpOperatorConfig) -> OperationalXpConfigOut:
    caps = row.category_daily_xp_caps if isinstance(row.category_daily_xp_caps, dict) else {}
    clean_caps: dict[str, int] = {}
    for k, v in caps.items():
        try:
            clean_caps[str(k).lower()] = int(v)
        except (TypeError, ValueError):
            continue
    th = row.professional_level_thresholds if isinstance(row.professional_level_thresholds, list) else None
    th_int: list[int] | None = None
    if th:
        try:
            th_int = [int(x) for x in th]
        except (TypeError, ValueError):
            th_int = None
    return OperationalXpConfigOut(
        recognitionRequiresApproval=bool(row.recognition_requires_approval),
        recognitionMonthlyLimitPerUser=int(row.recognition_monthly_limit_per_user or 12),
        recognitionMaxPerTargetPerMonth=int(row.recognition_max_per_target_per_month or 4),
        categoryDailyXpCaps=clean_caps,
        professionalLevelThresholds=th_int,
    )


@router.get("/config", response_model=OperationalXpConfigOut)
async def get_operational_xp_config(
    db: Db,
    cid: CompanyId,
    user: User = Depends(require_tenant_user),
) -> OperationalXpConfigOut:
    if not user_has_any_role(user, UserRole.company_admin, UserRole.manager):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin or manager required")
    row = await db.get(PulseXpOperatorConfig, cid)
    if not row:
        row = PulseXpOperatorConfig(company_id=cid)
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return _cfg_out(row)


@router.patch("/config", response_model=OperationalXpConfigOut)
async def patch_operational_xp_config(
    db: Db,
    cid: CompanyId,
    body: OperationalXpConfigPatchIn,
    user: User = Depends(require_tenant_user),
) -> OperationalXpConfigOut:
    if not user_has_any_role(user, UserRole.company_admin, UserRole.manager):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin or manager required")
    row = await db.get(PulseXpOperatorConfig, cid)
    if not row:
        row = PulseXpOperatorConfig(company_id=cid)
        db.add(row)
        await db.flush()
    data = body.model_dump(exclude_unset=True, by_alias=False)
    if "recognition_requires_approval" in data and data["recognition_requires_approval"] is not None:
        row.recognition_requires_approval = bool(data["recognition_requires_approval"])
    if "recognition_monthly_limit_per_user" in data and data["recognition_monthly_limit_per_user"] is not None:
        row.recognition_monthly_limit_per_user = int(data["recognition_monthly_limit_per_user"])
    if "recognition_max_per_target_per_month" in data and data["recognition_max_per_target_per_month"] is not None:
        row.recognition_max_per_target_per_month = int(data["recognition_max_per_target_per_month"])
    if "category_daily_xp_caps" in data and data["category_daily_xp_caps"] is not None:
        row.category_daily_xp_caps = dict(data["category_daily_xp_caps"])
    if "professional_level_thresholds" in data:
        row.professional_level_thresholds = data["professional_level_thresholds"]
    row.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(row)
    return _cfg_out(row)


async def _hr_dept(db: AsyncSession, user_id: str) -> str | None:
    hr = await db.get(PulseWorkerHR, str(user_id))
    if hr and hr.department and str(hr.department).strip():
        return str(hr.department).strip()
    return None


@router.post("/recognitions", response_model=RecognitionOut)
async def create_recognition(
    db: Db,
    cid: CompanyId,
    body: RecognitionCreateIn,
    user: User = Depends(require_tenant_user),
) -> RecognitionOut:
    if str(body.to_worker_id) == str(user.id):
        raise HTTPException(status_code=400, detail="Cannot recognize yourself")
    if body.recognition_type == "supervisor_commendation" and not user_has_any_role(
        user, UserRole.supervisor, UserRole.manager, UserRole.company_admin
    ):
        raise HTTPException(status_code=403, detail="Supervisor commendation requires supervisor, manager, or admin")
    target = await db.get(User, str(body.to_worker_id))
    if not target or str(target.company_id) != cid:
        raise HTTPException(status_code=404, detail="Recipient not found")

    cfg_row = await db.get(PulseXpOperatorConfig, cid)
    if not cfg_row:
        cfg_row = PulseXpOperatorConfig(company_id=cid)
        db.add(cfg_row)
        await db.flush()
    cfg = _cfg_out(cfg_row)

    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    sent_m = (
        await db.execute(
            select(func.count())
            .select_from(PulseWorkerRecognition)
            .where(
                PulseWorkerRecognition.company_id == cid,
                PulseWorkerRecognition.from_worker_id == str(user.id),
                PulseWorkerRecognition.created_at >= month_start,
            )
        )
    ).scalar_one()
    if int(sent_m or 0) >= int(cfg.recognition_monthly_limit_per_user):
        raise HTTPException(status_code=400, detail="Monthly recognition limit reached")

    to_m = (
        await db.execute(
            select(func.count())
            .select_from(PulseWorkerRecognition)
            .where(
                PulseWorkerRecognition.company_id == cid,
                PulseWorkerRecognition.from_worker_id == str(user.id),
                PulseWorkerRecognition.to_worker_id == str(body.to_worker_id),
                PulseWorkerRecognition.created_at >= month_start,
            )
        )
    ).scalar_one()
    if int(to_m or 0) >= int(cfg.recognition_max_per_target_per_month):
        raise HTTPException(status_code=400, detail="Recognition limit for this colleague reached this month")

    st = "pending" if cfg.recognition_requires_approval else "approved"
    now = datetime.now(timezone.utc)
    rec = PulseWorkerRecognition(
        id=str(uuid4()),
        company_id=cid,
        from_worker_id=str(user.id),
        to_worker_id=str(body.to_worker_id),
        from_department=await _hr_dept(db, str(user.id)),
        to_department=await _hr_dept(db, str(body.to_worker_id)),
        recognition_type=str(body.recognition_type),
        comment=str(body.comment).strip(),
        status=st,
        approved_by_user_id=str(user.id) if st == "approved" else None,
        approved_at=now if st == "approved" else None,
    )
    db.add(rec)
    await db.flush()

    if st == "approved":
        xp_amt = int(RECOGNITION_XP.get(str(body.recognition_type), 5))
        rc = (
            "supervisor_commendation"
            if body.recognition_type == "supervisor_commendation"
            else "cross_department_recognition"
            if body.recognition_type == "cross_department"
            else "peer_recognition"
        )
        await award_operational_xp(
            db,
            company_id=cid,
            user_id=str(body.to_worker_id),
            track="worker",
            amount=xp_amt,
            reason_code=rc,
            dedupe_key=f"recognition:{rec.id}",
            meta={"recognition_id": str(rec.id), "category": "recognition"},
            reason=f"Recognition · {body.recognition_type.replace('_', ' ')}",
            category="recognition",
            source_type="recognition",
            source_id=str(rec.id),
            apply_caps=True,
        )
        st_rec = await db.get(UserStats, str(body.to_worker_id))
        if st_rec and str(st_rec.company_id) == cid:
            st_rec.recognitions_received = int(getattr(st_rec, "recognitions_received", 0) or 0) + 1

    await db.commit()
    await db.refresh(rec)
    return RecognitionOut(
        id=str(rec.id),
        fromWorkerId=str(rec.from_worker_id),
        toWorkerId=str(rec.to_worker_id),
        fromDepartment=rec.from_department,
        toDepartment=rec.to_department,
        recognitionType=str(rec.recognition_type),
        comment=str(rec.comment),
        status=str(rec.status),
        approvedByUserId=str(rec.approved_by_user_id) if rec.approved_by_user_id else None,
        approvedAt=rec.approved_at,
        createdAt=rec.created_at,
    )


@router.post("/recognitions/{recognition_id}/moderate", response_model=RecognitionOut)
async def moderate_recognition(
    recognition_id: str,
    db: Db,
    cid: CompanyId,
    body: RecognitionApproveIn,
    user: User = Depends(require_tenant_user),
) -> RecognitionOut:
    if not user_has_any_role(user, UserRole.company_admin, UserRole.manager, UserRole.supervisor):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Approver role required")
    rec = await db.get(PulseWorkerRecognition, recognition_id)
    if not rec or str(rec.company_id) != cid:
        raise HTTPException(status_code=404, detail="Recognition not found")
    if rec.status != "pending":
        raise HTTPException(status_code=400, detail="Already processed")

    now = datetime.now(timezone.utc)
    if body.approve:
        rec.status = "approved"
        rec.approved_by_user_id = str(user.id)
        rec.approved_at = now
        xp_amt = int(RECOGNITION_XP.get(str(rec.recognition_type), 5))
        rc = (
            "supervisor_commendation"
            if rec.recognition_type == "supervisor_commendation"
            else "cross_department_recognition"
            if rec.recognition_type == "cross_department"
            else "peer_recognition"
        )
        await award_operational_xp(
            db,
            company_id=cid,
            user_id=str(rec.to_worker_id),
            track="worker",
            amount=xp_amt,
            reason_code=rc,
            dedupe_key=f"recognition:{rec.id}",
            meta={"recognition_id": str(rec.id), "category": "recognition"},
            reason="Recognition approved",
            category="recognition",
            source_type="recognition",
            source_id=str(rec.id),
        )
        st_rec = await db.get(UserStats, str(rec.to_worker_id))
        if st_rec and str(st_rec.company_id) == cid:
            st_rec.recognitions_received = int(getattr(st_rec, "recognitions_received", 0) or 0) + 1
    else:
        rec.status = "rejected"
        rec.approved_by_user_id = str(user.id)
        rec.approved_at = now

    await db.commit()
    await db.refresh(rec)
    return RecognitionOut(
        id=str(rec.id),
        fromWorkerId=str(rec.from_worker_id),
        toWorkerId=str(rec.to_worker_id),
        fromDepartment=rec.from_department,
        toDepartment=rec.to_department,
        recognitionType=str(rec.recognition_type),
        comment=str(rec.comment),
        status=str(rec.status),
        approvedByUserId=str(rec.approved_by_user_id) if rec.approved_by_user_id else None,
        approvedAt=rec.approved_at,
        createdAt=rec.created_at,
    )
