"""Employee development endpoints under `/api/workers`."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.dialects.postgresql import array as pg_array
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.api.workers_routes import (
    CompanyId,
    Db,
    RosterPageUser,
    _roster_user_in_company_any_status,
)
from app.api.workers_routes import _ROSTER_ROLES  # noqa: PLC2701
from app.models.domain import User
from app.models.pulse_models import PulseWorkerHR
from app.schemas.worker_development import (
    RecognitionFeedOut,
    WorkerDevelopmentDetailOut,
    WorkerDevelopmentListOut,
    WorkerDevelopmentPatchIn,
    WorkerDevelopmentPatchResultOut,
)
from app.services.worker_development import (
    get_development_detail,
    list_development_summaries,
    list_recognition_feed,
    patch_development,
)

router = APIRouter(prefix="/workers", tags=["workers-development"])


async def _hr_for_user(db: AsyncSession, user_id: str) -> PulseWorkerHR | None:
    return await db.get(PulseWorkerHR, user_id)


@router.get("/development", response_model=WorkerDevelopmentListOut)
async def list_worker_development(
    db: Db,
    _: RosterPageUser,
    cid: CompanyId,
    q: Optional[str] = Query(None),
    include_inactive: bool = Query(True),
) -> WorkerDevelopmentListOut:
    roster_vals = [r.value for r in _ROSTER_ROLES]
    stmt = select(User).where(
        User.company_id == cid,
        User.roles.overlap(pg_array(roster_vals)),
    )
    if not include_inactive:
        stmt = stmt.where(User.is_active.is_(True))
    if q and q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(User.email.ilike(like), User.full_name.ilike(like)))
    users = list((await db.execute(stmt)).scalars().all())
    users.sort(key=lambda u: ((u.full_name or u.email or "").lower()))

    hr_map: dict[str, PulseWorkerHR] = {}
    if users:
        hid = [u.id for u in users]
        hq = await db.execute(select(PulseWorkerHR).where(PulseWorkerHR.user_id.in_(hid)))
        for h in hq.scalars().all():
            hr_map[str(h.user_id)] = h

    items, last_updated = await list_development_summaries(db, company_id=cid, users=users, hr_map=hr_map)
    await db.commit()
    return WorkerDevelopmentListOut(items=items, last_updated_at=last_updated)


@router.get("/development/recognition-feed", response_model=RecognitionFeedOut)
async def get_recognition_feed(
    db: Db,
    _: RosterPageUser,
    cid: CompanyId,
    limit: int = Query(20, ge=1, le=100),
) -> RecognitionFeedOut:
    items = await list_recognition_feed(db, company_id=cid, limit=limit)
    return RecognitionFeedOut(items=items)


@router.get("/{user_id}/development", response_model=WorkerDevelopmentDetailOut)
async def get_worker_development(
    db: Db,
    _: RosterPageUser,
    cid: CompanyId,
    user_id: str,
) -> WorkerDevelopmentDetailOut:
    user = await _roster_user_in_company_any_status(db, cid, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Worker not found")
    hr = await _hr_for_user(db, user_id)
    detail = await get_development_detail(db, company_id=cid, user=user, hr=hr)
    await db.commit()
    return WorkerDevelopmentDetailOut(**detail)


@router.patch("/{user_id}/development", response_model=WorkerDevelopmentPatchResultOut)
async def patch_worker_development(
    db: Db,
    actor: RosterPageUser,
    cid: CompanyId,
    user_id: str,
    body: WorkerDevelopmentPatchIn,
) -> WorkerDevelopmentPatchResultOut:
    user = await _roster_user_in_company_any_status(db, cid, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Worker not found")
    hr = await _hr_for_user(db, user_id)
    payload = body.model_dump(exclude_unset=True)
    if body.add_recognition is not None:
        rec = dict(payload.get("add_recognition") or {})
        rec.setdefault("awarded_by_user_id", str(actor.id))
        rec.setdefault("awarded_by", actor.full_name or actor.email)
        payload["add_recognition"] = rec
    detail, plan_overwrite_required, message = await patch_development(
        db,
        company_id=cid,
        user=user,
        hr=hr,
        payload=payload,
    )
    if plan_overwrite_required:
        await db.rollback()
        return WorkerDevelopmentPatchResultOut(
            detail=WorkerDevelopmentDetailOut(**detail),
            plan_overwrite_required=True,
            message=message,
        )
    await db.commit()
    return WorkerDevelopmentPatchResultOut(
        detail=WorkerDevelopmentDetailOut(**detail),
        plan_overwrite_required=False,
        message=message,
    )
