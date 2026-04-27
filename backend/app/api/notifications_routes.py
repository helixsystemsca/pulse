"""Automation notification actions + app notification helpers (push tokens, inbox stub)."""

from __future__ import annotations

import logging
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.user_roles import is_elevated_tenant_staff, user_has_any_role
from app.models.automation_engine import AutomationNotification
from app.models.domain import User, UserRole
from app.schemas.api_common import ApiSuccess
from app.services.automation.operational_service import acknowledge_notification

router = APIRouter(prefix="/notifications", tags=["notifications"])

Db = Annotated[AsyncSession, Depends(get_db)]

log = logging.getLogger("pulse.app_notifications")

# In-memory stores — replace with DB tables for production (see TODO in M6 handoff).
_push_tokens: dict[str, list[dict[str, str]]] = {}
_notifications_by_company: dict[str, list[dict[str, Any]]] = {}
_notifications_by_user: dict[str, list[dict[str, Any]]] = {}


class PushTokenIn(BaseModel):
    token: str
    platform: str


class NotificationOut(BaseModel):
    id: str
    event_type: str
    title: str
    body: str
    read: bool
    created_at: str
    metadata: dict[str, Any] = Field(default_factory=dict)


@router.post("/push-token", status_code=status.HTTP_204_NO_CONTENT)
async def register_push_token(
    body: PushTokenIn,
    user: Annotated[User, Depends(get_current_user)],
) -> None:
    uid = str(user.id)
    lst = _push_tokens.setdefault(uid, [])
    if not any(t["token"] == body.token for t in lst):
        lst.append({"token": body.token, "platform": body.platform})
    log.info("push_token registered user=%s platform=%s", uid[:8], body.platform)


@router.get("", response_model=list[NotificationOut])
async def list_app_notifications(
    user: Annotated[User, Depends(get_current_user)],
    limit: int = Query(30, ge=1, le=200),
) -> list[NotificationOut]:
    """Recent notifications for the signed-in user (stub until persisted inbox exists)."""
    if user.company_id is None:
        return []
    cid = str(user.company_id)
    uid = str(user.id)
    company_rows = list(_notifications_by_company.get(cid, []))
    user_rows = list(_notifications_by_user.get(uid, []))
    merged = sorted(
        company_rows + user_rows,
        key=lambda n: n.get("created_at", ""),
        reverse=True,
    )[:limit]
    return [NotificationOut(**n) for n in merged]


@router.post("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_notification_read_app(
    notification_id: str,
    user: Annotated[User, Depends(get_current_user)],
) -> None:
    if user.company_id is None:
        return
    cid = str(user.company_id)
    uid = str(user.id)
    for bucket in (_notifications_by_company.get(cid, []), _notifications_by_user.get(uid, [])):
        for n in bucket:
            if n.get("id") == notification_id:
                n["read"] = True
                return


@router.post("/{notification_id}/acknowledge", response_model=ApiSuccess[dict])
async def acknowledge_automation_notification(
    notification_id: str,
    db: Db,
    user: Annotated[User, Depends(get_current_user)],
) -> ApiSuccess[dict]:
    if user_has_any_role(user, UserRole.system_admin) or user.is_system_admin:
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
    if not is_elevated_tenant_staff(user) and str(row.user_id) != str(user.id):
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
