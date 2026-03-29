"""Tool tracking API — gated by `tool_tracking` feature flag."""

from typing import Annotated, Any, Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_inference_engine, get_state_manager, require_company_admin_scoped
from app.core.database import get_db
from app.core.events.engine import event_engine
from app.core.events.types import DomainEvent
from app.core.inference.engine import InferenceEngine
from app.core.state.manager import StateManager
from app.models.domain import Tool, ToolStatus, User
from app.modules.tool_tracking import MODULE_KEY
from app.modules.tool_tracking.schemas import MissingScanIn, ProximityAssignIn, ToolCreate, ZoneTransitionIn

router = APIRouter(prefix="/tool-tracking", tags=["tool_tracking"])


@router.get("/tools")
async def list_tools(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[dict[str, Any]]:
    q = await db.execute(select(Tool).where(Tool.company_id == user.company_id))
    tools = q.scalars().all()
    return [
        {
            "id": t.id,
            "tag_id": t.tag_id,
            "name": t.name,
            "zone_id": t.zone_id,
            "assigned_user_id": t.assigned_user_id,
            "status": t.status.value,
        }
        for t in tools
    ]


@router.post("/tools")
async def create_tool(
    body: ToolCreate,
    user: Annotated[User, Depends(require_company_admin_scoped)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    tool = Tool(company_id=user.company_id, tag_id=body.tag_id, name=body.name)
    db.add(tool)
    await db.flush()
    ev = DomainEvent(
        event_type="tool.registered",
        company_id=user.company_id,
        entity_id=tool.id,
        metadata={"tool_id": tool.id, "tag_id": tool.tag_id},
        source_module=MODULE_KEY,
    )
    await event_engine.publish(ev)
    await db.commit()
    return {"id": tool.id, "tag_id": tool.tag_id}


@router.post("/zone-events")
async def zone_event(
    body: ZoneTransitionIn,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    state: Annotated[StateManager, Depends(get_state_manager)],
) -> dict[str, Any]:
    q = await db.execute(
        select(Tool).where(Tool.company_id == user.company_id, Tool.tag_id == body.tag_id)
    )
    tool = q.scalar_one_or_none()
    if not tool:
        return {"ok": False, "detail": "unknown tag"}

    zone_id: Optional[str] = None if body.transition == "exit" else body.zone_id
    await state.set_tool_zone(user.company_id, tool, zone_id, MODULE_KEY)
    worker_hint = body.worker_user_id or user.id
    if body.transition == "exit":
        ev = DomainEvent(
            event_type="zone.exit",
            company_id=user.company_id,
            entity_id=tool.id,
            metadata={"tag_id": body.tag_id, "zone_id": body.zone_id},
            source_module=MODULE_KEY,
        )
    else:
        ev = DomainEvent(
            event_type="zone.entry",
            company_id=user.company_id,
            entity_id=tool.id,
            metadata={
                "tag_id": body.tag_id,
                "zone_id": body.zone_id,
                "worker_user_id": worker_hint,
                **({"signal_strength": body.signal_strength} if body.signal_strength is not None else {}),
            },
            source_module=MODULE_KEY,
        )
    await event_engine.publish(ev)
    await db.commit()
    return {"ok": True, "tool_id": tool.id, "zone_id": zone_id}


@router.post("/assign-proximity")
async def assign_proximity(
    body: ProximityAssignIn,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    inference: Annotated[InferenceEngine, Depends(get_inference_engine)],
) -> dict[str, Any]:
    q = await db.execute(
        select(Tool).where(Tool.company_id == user.company_id, Tool.tag_id == body.tool_tag_id)
    )
    tool = q.scalar_one_or_none()
    if not tool:
        return {"ok": False}
    updated = await inference.assign_tool_by_worker_zone_proximity(
        user.company_id, tool, body.worker_user_id, MODULE_KEY
    )
    await db.commit()
    return {"ok": bool(updated)}


@router.post("/missing-scan")
async def missing_scan(
    body: MissingScanIn,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    inference: Annotated[InferenceEngine, Depends(get_inference_engine)],
) -> dict[str, Any]:
    missing = await inference.flag_missing_tools(user.company_id, set(body.expected_tag_ids), MODULE_KEY)
    await event_engine.publish(
        DomainEvent(
            event_type="tool.missing_scan_complete",
            company_id=user.company_id,
            metadata={"missing": missing},
            source_module=MODULE_KEY,
        )
    )
    await db.commit()
    return {"missing_tag_ids": missing}


@router.get("/worker/tools")
async def my_tools(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[dict[str, Any]]:
    q = await db.execute(
        select(Tool).where(Tool.company_id == user.company_id, Tool.assigned_user_id == user.id)
    )
    tools = q.scalars().all()
    return [
        {
            "id": t.id,
            "tag_id": t.tag_id,
            "name": t.name,
            "status": t.status.value,
            "zone_id": t.zone_id,
        }
        for t in tools
    ]


@router.get("/worker/missing")
async def worker_site_missing_tools(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[dict[str, Any]]:
    """All tools marked missing on the tenant floor (glanceable for crews)."""
    q = await db.execute(
        select(Tool)
        .where(Tool.company_id == user.company_id, Tool.status == ToolStatus.missing)
        .order_by(Tool.name)
    )
    tools = q.scalars().all()
    return [
        {
            "id": t.id,
            "tag_id": t.tag_id,
            "name": t.name,
            "assigned_user_id": t.assigned_user_id,
        }
        for t in tools
    ]
