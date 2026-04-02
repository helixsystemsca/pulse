"""Automation notification actions (acknowledgement → internal automation_event)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.automation_engine import AutomationNotification
from app.models.domain import User, UserRole
from app.schemas.api_common import ApiSuccess
from app.services.automation.operational_service import acknowledge_notification

router = APIRouter(prefix="/notifications", tags=["notifications"])

Db = Annotated[AsyncSession, Depends(get_db)]


@router.post("/{notification_id}/acknowledge", response_model=ApiSuccess[dict])
async def acknowledge_automation_notification(
    notification_id: str,
    db: Db,
    user: Annotated[User, Depends(get_current_user)],
) -> ApiSuccess[dict]:
    if user.role == UserRole.system_admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Company user JWT required for notification acknowledgement",
        )
    if user.company_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Company context required")
    company_id = str(user.company_id)

    q = await db.execute(
        select(AutomationNotification).where(
            AutomationNotification.id == notification_id,
            AutomationNotification.company_id == company_id,
        )
    )
    row = q.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="notification not found")
    if user.role == UserRole.worker and str(row.user_id) != str(user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your notification")

    result = await acknowledge_notification(
        db,
        company_id=company_id,
        notification_id=notification_id,
        actor_user_id=str(user.id),
    )
    if not result.get("ok"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="notification not found")
    await db.commit()
    return ApiSuccess(data=result)
