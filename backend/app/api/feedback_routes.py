"""User-submitted product feedback (tenant admins + XP rewards)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Annotated, Literal, cast

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_company_admin_user, get_current_company_user, get_db
from app.core.feedback_features import FEEDBACK_FEATURE_OPTIONS, VALID_FEEDBACK_FEATURE_KEYS
from app.core.user_roles import user_has_tenant_full_admin
from app.limiter import limiter
from app.models.domain import User
from app.models.pulse_models import PulseUserFeedback
from app.services.xp_grant import try_grant_xp
from app.services.xp_role_policy import assigner_operational_track, is_xp_excluded_admin

router = APIRouter(prefix="/feedback", tags=["feedback"])
log = logging.getLogger(__name__)

Db = Annotated[AsyncSession, Depends(get_db)]
TenantAdmin = Annotated[User, Depends(get_current_company_admin_user)]


class FeedbackFeatureOut(BaseModel):
    id: str
    label: str


class FeedbackSubmitIn(BaseModel):
    feature_key: str = Field(..., min_length=1, max_length=64)
    body: str = Field(..., min_length=4, max_length=4000)


class FeedbackRowOut(BaseModel):
    id: str
    company_id: str
    author_user_id: str
    author_email: str | None = None
    author_name: str | None = None
    feature_key: str
    feature_label: str
    body: str
    created_at: str
    admin_read_at: str | None = None
    xp_awarded_at: str | None = None
    xp_amount: int = 0
    rewarded_by_user_id: str | None = None


class FeedbackAwardIn(BaseModel):
    xp_amount: int = Field(25, ge=1, le=200)


_LABEL_BY_KEY: dict[str, str] = {k: v for k, v in FEEDBACK_FEATURE_OPTIONS}


def _label_for_key(key: str) -> str:
    return _LABEL_BY_KEY.get(key, key.replace("_", " ").title())


def _row_out(fb: PulseUserFeedback, au: User) -> FeedbackRowOut:
    return FeedbackRowOut(
        id=str(fb.id),
        company_id=str(fb.company_id),
        author_user_id=str(fb.author_user_id),
        author_email=au.email,
        author_name=(au.full_name or "").strip() or None,
        feature_key=fb.feature_key,
        feature_label=_label_for_key(fb.feature_key),
        body=fb.body,
        created_at=fb.created_at.isoformat(),
        admin_read_at=fb.admin_read_at.isoformat() if fb.admin_read_at else None,
        xp_awarded_at=fb.xp_awarded_at.isoformat() if fb.xp_awarded_at else None,
        xp_amount=int(fb.xp_amount or 0),
        rewarded_by_user_id=str(fb.rewarded_by_user_id) if fb.rewarded_by_user_id else None,
    )


def _xp_track_for_recipient(user: User) -> str | None:
    t = assigner_operational_track(user)
    if t:
        return t
    if is_xp_excluded_admin(user):
        return None
    return "worker"


@router.get("/features", response_model=list[FeedbackFeatureOut])
async def list_feedback_features(
    _: Annotated[User, Depends(get_current_company_user)],
) -> list[FeedbackFeatureOut]:
    return [FeedbackFeatureOut(id=k, label=v) for k, v in FEEDBACK_FEATURE_OPTIONS]


@router.get("/unread-count")
async def feedback_unread_count(
    user: Annotated[User, Depends(get_current_company_user)],
    db: Db,
) -> dict[str, int]:
    if not user_has_tenant_full_admin(user) or user.company_id is None:
        return {"count": 0}
    cid = str(user.company_id)
    q = await db.scalar(
        select(func.count())
        .select_from(PulseUserFeedback)
        .where(
            PulseUserFeedback.company_id == cid,
            PulseUserFeedback.admin_read_at.is_(None),
            PulseUserFeedback.deleted_at.is_(None),
        )
    )
    return {"count": int(q or 0)}


@router.post("", response_model=FeedbackRowOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("12/minute")
async def submit_feedback(
    request: Request,
    body: FeedbackSubmitIn,
    user: Annotated[User, Depends(get_current_company_user)],
    db: Db,
) -> FeedbackRowOut:
    if user.company_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant company required")
    fk = body.feature_key.strip()
    if fk not in VALID_FEEDBACK_FEATURE_KEYS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown feature_key")
    text = body.body.strip()
    if len(text) < 4:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Comment is too short")

    row = PulseUserFeedback(
        company_id=str(user.company_id),
        author_user_id=str(user.id),
        feature_key=fk,
        body=text,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    log.info(
        "feedback submitted id=%s company=%s author=%s feature=%s",
        row.id,
        row.company_id,
        row.author_user_id,
        fk,
    )
    return _row_out(row, user)


@router.get("", response_model=list[FeedbackRowOut])
async def list_company_feedback(
    user: TenantAdmin,
    db: Db,
    limit: int = Query(50, ge=1, le=200),
) -> list[FeedbackRowOut]:
    cid = str(user.company_id)
    q = await db.execute(
        select(PulseUserFeedback, User)
        .join(User, User.id == PulseUserFeedback.author_user_id)
        .where(PulseUserFeedback.company_id == cid, PulseUserFeedback.deleted_at.is_(None))
        .order_by(PulseUserFeedback.created_at.desc())
        .limit(limit)
    )
    rows = q.all()
    return [_row_out(fb, au) for fb, au in rows]


@router.post("/mark-all-read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_feedback_read(
    user: TenantAdmin,
    db: Db,
) -> None:
    cid = str(user.company_id)
    now = datetime.now(timezone.utc)
    await db.execute(
        update(PulseUserFeedback)
        .where(
            PulseUserFeedback.company_id == cid,
            PulseUserFeedback.admin_read_at.is_(None),
            PulseUserFeedback.deleted_at.is_(None),
        )
        .values(admin_read_at=now)
    )
    await db.commit()


@router.post("/{feedback_id}/read", response_model=FeedbackRowOut)
async def mark_feedback_read(
    feedback_id: str,
    user: TenantAdmin,
    db: Db,
) -> FeedbackRowOut:
    cid = str(user.company_id)
    fb = await db.get(PulseUserFeedback, feedback_id)
    if not fb or str(fb.company_id) != cid or fb.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feedback not found")
    now = datetime.now(timezone.utc)
    if fb.admin_read_at is None:
        fb.admin_read_at = now
        await db.commit()
        await db.refresh(fb)
    author = await db.get(User, str(fb.author_user_id))
    if not author:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Author not found")
    return _row_out(fb, author)


@router.delete("/{feedback_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_feedback(
    feedback_id: str,
    user: TenantAdmin,
    db: Db,
) -> None:
    cid = str(user.company_id)
    fb = await db.get(PulseUserFeedback, feedback_id)
    if not fb or str(fb.company_id) != cid or fb.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feedback not found")
    fb.deleted_at = datetime.now(timezone.utc)
    await db.commit()


@router.post("/{feedback_id}/award-xp", response_model=FeedbackRowOut)
async def award_feedback_xp(
    feedback_id: str,
    body: FeedbackAwardIn,
    user: TenantAdmin,
    db: Db,
) -> FeedbackRowOut:
    cid = str(user.company_id)
    fb = await db.get(PulseUserFeedback, feedback_id)
    if not fb or str(fb.company_id) != cid or fb.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feedback not found")
    if fb.xp_awarded_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="XP already awarded for this feedback")

    author = await db.get(User, str(fb.author_user_id))
    if not author or str(author.company_id) != cid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Author not found in tenant")

    track = _xp_track_for_recipient(author)
    if track is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account type does not participate in the XP program.",
        )

    amt = int(body.xp_amount)
    dedupe = f"product_feedback_reward:{fb.id}"
    track_t = cast(Literal["worker", "lead", "supervisor"], track)
    res = await try_grant_xp(
        db,
        company_id=cid,
        user_id=str(author.id),
        track=track_t,
        amount=amt,
        reason_code="product_feedback_helpful",
        dedupe_key=dedupe,
        meta={"feedback_id": str(fb.id), "feature_key": fb.feature_key},
        reason="Helpful product feedback",
        counts_toward_streak=False,
    )
    if res.applied <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not apply XP (already granted, cap, or ineligible).",
        )

    now = datetime.now(timezone.utc)
    fb.xp_awarded_at = now
    fb.xp_amount = amt
    fb.rewarded_by_user_id = str(user.id)
    if fb.admin_read_at is None:
        fb.admin_read_at = now
    await db.commit()
    await db.refresh(fb)

    return _row_out(fb, author)
