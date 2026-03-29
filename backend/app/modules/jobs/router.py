"""Jobs module."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_company_admin_scoped
from app.core.database import get_db
from app.core.events.engine import event_engine
from app.core.events.types import DomainEvent
from app.models.domain import InventoryItem, Job, JobInventoryLink, JobToolLink, JobStatus, Tool, User
from app.modules.jobs import MODULE_KEY
from app.modules.jobs.schemas import JobActivityHint, JobCreate, JobLinkInventory, JobLinkTool

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/")
async def list_jobs(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[dict[str, Any]]:
    q = await db.execute(select(Job).where(Job.company_id == user.company_id))
    rows = q.scalars().all()
    return [
        {"id": r.id, "title": r.title, "status": r.status.value, "worker_id": r.worker_id} for r in rows
    ]


@router.post("/")
async def create_job(
    body: JobCreate,
    user: Annotated[User, Depends(require_company_admin_scoped)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    job = Job(
        company_id=user.company_id,
        title=body.title,
        status=body.status,
        worker_id=body.worker_id,
    )
    db.add(job)
    await db.flush()
    await event_engine.publish(
        DomainEvent(
            event_type="job.created",
            company_id=user.company_id,
            entity_id=job.id,
            metadata={"job_id": job.id, "title": job.title},
            source_module=MODULE_KEY,
        )
    )
    await db.commit()
    return {"id": job.id}


@router.post("/{job_id}/tools")
async def link_tool(
    job_id: str,
    body: JobLinkTool,
    user: Annotated[User, Depends(require_company_admin_scoped)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, bool]:
    jq = await db.execute(select(Job).where(Job.id == job_id, Job.company_id == user.company_id))
    job = jq.scalar_one_or_none()
    tq = await db.execute(select(Tool).where(Tool.id == body.tool_id, Tool.company_id == user.company_id))
    tool = tq.scalar_one_or_none()
    if not job or not tool:
        raise HTTPException(status_code=404, detail="Job or tool not found")
    db.add(JobToolLink(job_id=job.id, tool_id=tool.id))
    await db.flush()
    await event_engine.publish(
        DomainEvent(
            event_type="job.tool_linked",
            company_id=user.company_id,
            entity_id=job.id,
            metadata={"job_id": job.id, "tool_id": tool.id},
            source_module=MODULE_KEY,
        )
    )
    await db.commit()
    return {"ok": True}


@router.post("/{job_id}/inventory")
async def link_inventory(
    job_id: str,
    body: JobLinkInventory,
    user: Annotated[User, Depends(require_company_admin_scoped)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, bool]:
    jq = await db.execute(select(Job).where(Job.id == job_id, Job.company_id == user.company_id))
    job = jq.scalar_one_or_none()
    iq = await db.execute(
        select(InventoryItem).where(
            InventoryItem.id == body.inventory_item_id, InventoryItem.company_id == user.company_id
        )
    )
    inv = iq.scalar_one_or_none()
    if not job or not inv:
        raise HTTPException(status_code=404, detail="Job or inventory not found")
    db.add(
        JobInventoryLink(
            job_id=job.id,
            inventory_item_id=inv.id,
            quantity_allocated=body.quantity_allocated,
        )
    )
    await db.flush()
    await event_engine.publish(
        DomainEvent(
            event_type="job.inventory_linked",
            company_id=user.company_id,
            entity_id=job.id,
            metadata={"job_id": job.id, "inventory_item_id": inv.id},
            source_module=MODULE_KEY,
        )
    )
    await db.commit()
    return {"ok": True}


@router.post("/{job_id}/activity")
async def activity(
    job_id: str,
    body: JobActivityHint,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    jq = await db.execute(select(Job).where(Job.id == job_id, Job.company_id == user.company_id))
    job = jq.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status == JobStatus.draft:
        job.status = JobStatus.active
    await db.flush()
    await event_engine.publish(
        DomainEvent(
            event_type="job.activity_detected",
            company_id=user.company_id,
            entity_id=job.id,
            metadata={"job_id": job.id, "hint": body.hint},
            source_module=MODULE_KEY,
        )
    )
    await db.commit()
    return {"status": job.status.value}
