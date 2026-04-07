"""Company admin: overview, feature flags, audit read (append-only store)."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import array as pg_array
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_company_admin_scoped
from app.core.database import get_db
from app.core.events.engine import event_engine
from app.core.events.types import DomainEvent
from app.core.features.service import MODULE_KEYS, FeatureFlagService
from app.models.domain import AuditLog, InventoryItem, Tool, User, UserRole
from app.schemas.common import FeatureToggle

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/overview")
async def overview(
    admin: Annotated[User, Depends(require_company_admin_scoped)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    cid = str(admin.company_id)
    tools_c = await db.scalar(select(func.count()).select_from(Tool).where(Tool.company_id == cid))
    inv_c = await db.scalar(select(func.count()).select_from(InventoryItem).where(InventoryItem.company_id == cid))
    workers_c = await db.scalar(
        select(func.count())
        .select_from(User)
        .where(
            User.company_id == cid,
            User.roles.overlap(pg_array([UserRole.worker.value])),
        )
    )
    return {
        "company_id": cid,
        "counts": {"tools": tools_c or 0, "inventory_items": inv_c or 0, "workers": workers_c or 0},
    }


@router.get("/features")
async def list_features(
    admin: Annotated[User, Depends(require_company_admin_scoped)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, bool]:
    svc = FeatureFlagService(db)
    return await svc.list_for_company(str(admin.company_id))


@router.post("/features")
async def set_feature(
    admin: Annotated[User, Depends(require_company_admin_scoped)],
    db: Annotated[AsyncSession, Depends(get_db)],
    body: FeatureToggle,
) -> dict[str, bool]:
    if body.module_key not in MODULE_KEYS:
        raise HTTPException(status_code=400, detail="Unknown module_key")
    svc = FeatureFlagService(db)
    await svc.set_module(str(admin.company_id), body.module_key, body.enabled)
    ev = DomainEvent(
        event_type="company.module_toggled",
        company_id=str(admin.company_id),
        metadata={"module_key": body.module_key, "enabled": body.enabled},
        source_module="core",
    )
    await event_engine.publish(ev)
    await db.commit()
    return await svc.list_for_company(str(admin.company_id))


@router.get("/audit")
async def list_audit_logs(
    admin: Annotated[User, Depends(require_company_admin_scoped)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=50, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[dict[str, Any]]:
    """Read-only listing. Audit rows are never deleted via API."""
    cid = str(admin.company_id)
    q = await db.execute(
        select(AuditLog)
        .where(AuditLog.company_id == cid)
        .order_by(AuditLog.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = q.scalars().all()
    return [
        {
            "id": r.id,
            "actor_user_id": r.actor_user_id,
            "company_id": r.company_id,
            "action": r.action,
            "metadata": r.metadata_,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]
