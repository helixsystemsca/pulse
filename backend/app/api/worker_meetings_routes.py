"""Worker meetings API under `/api/workers`."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status

from app.api.workers_routes import CompanyId, Db, RosterPageUser
from app.schemas.worker_meetings import (
    ActionItemListOut,
    WorkerMeetingCreateIn,
    WorkerMeetingListOut,
    WorkerMeetingOut,
    WorkerMeetingPatchIn,
)
from app.services.worker_meetings import create_meeting, list_action_items, list_meetings, patch_meeting

router = APIRouter(prefix="/workers", tags=["workers-meetings"])


@router.get("/meetings", response_model=WorkerMeetingListOut)
async def get_worker_meetings(
    db: Db,
    _: RosterPageUser,
    cid: CompanyId,
    employee_user_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
) -> WorkerMeetingListOut:
    items = await list_meetings(
        db,
        company_id=cid,
        employee_user_id=employee_user_id,
        status=status,
    )
    await db.commit()
    return WorkerMeetingListOut(items=items)


@router.get("/meetings/action-items", response_model=ActionItemListOut)
async def get_meeting_action_items(
    db: Db,
    _: RosterPageUser,
    cid: CompanyId,
    employee_user_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
) -> ActionItemListOut:
    items = await list_action_items(
        db,
        company_id=cid,
        employee_user_id=employee_user_id,
        status=status,
    )
    await db.commit()
    return ActionItemListOut(items=items)


@router.post("/meetings", response_model=WorkerMeetingOut, status_code=status.HTTP_201_CREATED)
async def post_worker_meeting(
    db: Db,
    actor: RosterPageUser,
    cid: CompanyId,
    body: WorkerMeetingCreateIn,
) -> WorkerMeetingOut:
    row = await create_meeting(
        db,
        company_id=cid,
        manager_user_id=str(actor.id),
        payload=body.model_dump(),
    )
    await db.commit()
    return WorkerMeetingOut(**row)


@router.patch("/meetings/{meeting_id}", response_model=WorkerMeetingOut)
async def patch_worker_meeting(
    db: Db,
    _: RosterPageUser,
    cid: CompanyId,
    meeting_id: str,
    body: WorkerMeetingPatchIn,
) -> WorkerMeetingOut:
    row = await patch_meeting(
        db,
        company_id=cid,
        meeting_id=meeting_id,
        payload=body.model_dump(exclude_unset=True),
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    await db.commit()
    return WorkerMeetingOut(**row)
