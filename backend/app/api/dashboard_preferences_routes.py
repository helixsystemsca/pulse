"""Per-user dashboard layout preferences (synced across browsers)."""

from __future__ import annotations

import re
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.domain import User
from app.schemas.dashboard_preferences import (
    DashboardLayoutBundleIn,
    DashboardLayoutBundleOut,
    DashboardLayoutSaveOut,
)

router = APIRouter(prefix="/profile/dashboard-layouts", tags=["profile"])

_CONTEXT_RE = re.compile(r"^[a-z][a-z0-9_]{0,63}$")


def _normalize_context(context: str) -> str:
    key = (context or "").strip().lower()
    if not _CONTEXT_RE.match(key):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid dashboard context")
    return key


def _ui_prefs(user: User) -> dict[str, Any]:
    raw = getattr(user, "ui_preferences", None)
    return dict(raw) if isinstance(raw, dict) else {}


def _dashboard_layouts(prefs: dict[str, Any]) -> dict[str, Any]:
    layouts = prefs.get("dashboardLayouts")
    return dict(layouts) if isinstance(layouts, dict) else {}


@router.get("/{context}", response_model=DashboardLayoutBundleOut | None)
async def get_my_dashboard_layout(
    context: str,
    user: Annotated[User, Depends(get_current_user)],
) -> DashboardLayoutBundleOut | None:
    key = _normalize_context(context)
    bundle = _dashboard_layouts(_ui_prefs(user)).get(key)
    if not isinstance(bundle, dict):
        return None
    layout = bundle.get("layout")
    if not isinstance(layout, dict):
        return None
    version = bundle.get("version")
    if not isinstance(version, int):
        return None
    custom = bundle.get("customWidgets")
    if not isinstance(custom, dict):
        custom = {}
    return DashboardLayoutBundleOut(version=version, layout=layout, custom_widgets=custom)


@router.put("/{context}", response_model=DashboardLayoutSaveOut)
async def put_my_dashboard_layout(
    context: str,
    body: DashboardLayoutBundleIn,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DashboardLayoutSaveOut:
    key = _normalize_context(context)
    if not isinstance(body.layout, dict):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="layout must be an object")
    for col in ("left", "hero", "right"):
        if col not in body.layout or not isinstance(body.layout[col], list):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"layout.{col} must be an array")

    prefs = _ui_prefs(user)
    layouts = _dashboard_layouts(prefs)
    layouts[key] = {
        "version": body.version,
        "layout": body.layout,
        "customWidgets": body.custom_widgets if isinstance(body.custom_widgets, dict) else {},
    }
    prefs["dashboardLayouts"] = layouts
    user.ui_preferences = prefs
    await db.commit()
    return DashboardLayoutSaveOut()
