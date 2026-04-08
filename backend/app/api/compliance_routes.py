"""
Compliance REST API under `/api/compliance`.

Multi-tenant: tenant users are scoped to JWT `company_id`; system admins must pass `company_id` query on each call.
Requires manager-or-above (`require_manager_or_above`).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, exists, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_manager_or_above
from app.core.org_module_settings_merge import merge_org_module_settings
from app.core.user_roles import primary_jwt_role, user_has_any_role
from app.models.domain import ComplianceRecord, ComplianceRule, Tool, User, UserRole
from app.models.pulse_models import PulseOrgModuleSettings
from app.modules.compliance import service as compliance_svc
from app.modules.compliance.service import effective_status
from app.schemas.compliance import (
    ComplianceFlagBody,
    ComplianceListOut,
    ComplianceRecordOut,
    ComplianceSummaryOut,
)

router = APIRouter(prefix="/compliance", tags=["compliance"])


async def resolve_compliance_company_id(
    user: Annotated[User, Depends(get_current_user)],
    company_id: Optional[str] = Query(None, description="Required for system administrators"),
) -> str:
    if user_has_any_role(user, UserRole.system_admin) or user.is_system_admin:
        if not company_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="company_id is required for system administrators",
            )
        return company_id
    if user.company_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a tenant user")
    cid = str(user.company_id)
    if company_id is not None and company_id != cid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Company access denied")
    return cid


CompanyId = Annotated[str, Depends(resolve_compliance_company_id)]
Db = Annotated[AsyncSession, Depends(get_db)]
ManagerUser = Annotated[User, Depends(require_manager_or_above)]


@router.get("/summary", response_model=ComplianceSummaryOut)
async def compliance_summary(
    db: Db,
    user: ManagerUser,
    cid: CompanyId,
) -> ComplianceSummaryOut:
    _ = user
    data = await compliance_svc.summarize(db, cid)
    return ComplianceSummaryOut.model_validate(data)


@router.get("", response_model=ComplianceListOut)
async def list_compliance(
    db: Db,
    user: ManagerUser,
    cid: CompanyId,
    status_filter: Optional[str] = Query(None, alias="status"),
    user_id: Optional[str] = Query(None),
    tool_id: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    q: Optional[str] = Query(None, description="Search user name"),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    sort: str = Query("date", description="date or status"),
    sort_dir: str = Query("desc", alias="dir", description="asc or desc"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> ComplianceListOut:
    _ = user
    now = datetime.now(timezone.utc)

    clauses = [ComplianceRecord.company_id == cid]
    cat = compliance_svc.parse_category(category)
    if cat:
        clauses.append(ComplianceRecord.category == cat)
    if user_id:
        clauses.append(ComplianceRecord.user_id == user_id)
    if tool_id:
        clauses.append(ComplianceRecord.tool_id == tool_id)
    if date_from:
        clauses.append(ComplianceRecord.created_at >= date_from)
    if date_to:
        clauses.append(ComplianceRecord.created_at <= date_to)
    if status_filter:
        flt = compliance_svc.effective_status_sql_filter(status_filter, now)
        if flt is None:
            raise HTTPException(status_code=400, detail="Invalid status filter")
        clauses.append(flt)

    name_clause = None
    if q and q.strip():
        like = f"%{q.strip()}%"
        name_clause = exists().where(and_(User.id == ComplianceRecord.user_id, User.full_name.ilike(like)))

    where_final = and_(*clauses, name_clause) if name_clause is not None else and_(*clauses)

    total_q = await db.execute(select(func.count()).select_from(ComplianceRecord).where(where_final))
    total = int(total_q.scalar_one() or 0)

    order_dir = sort_dir.lower()
    if order_dir not in ("asc", "desc"):
        raise HTTPException(status_code=400, detail="dir must be asc or desc")

    stmt = select(ComplianceRecord).where(where_final)
    if sort == "date":
        col = ComplianceRecord.required_at
        stmt = stmt.order_by(col.asc() if order_dir == "asc" else col.desc())
    elif sort == "status":
        stmt = stmt.order_by(
            ComplianceRecord.ignored.desc(),
            ComplianceRecord.status.asc(),
            ComplianceRecord.required_at.desc() if order_dir == "desc" else ComplianceRecord.required_at.asc(),
        )
    else:
        raise HTTPException(status_code=400, detail="sort must be date or status")

    stmt = stmt.offset(offset).limit(limit)
    rows = (await db.execute(stmt)).scalars().all()

    repeat_ids = await compliance_svc.repeat_offender_user_ids(db, cid, now)

    user_ids = {r.user_id for r in rows}
    tool_ids = {r.tool_id for r in rows if r.tool_id}
    users_map: dict[str, User] = {}
    tools_map: dict[str, Tool] = {}
    if user_ids:
        uq = await db.execute(select(User).where(User.id.in_(user_ids)))
        for u in uq.scalars().all():
            users_map[u.id] = u
    if tool_ids:
        tq = await db.execute(select(Tool).where(Tool.id.in_(tool_ids)))
        for t in tq.scalars().all():
            tools_map[t.id] = t

    items: list[ComplianceRecordOut] = []
    for r in rows:
        u = users_map.get(r.user_id)
        t = tools_map.get(r.tool_id) if r.tool_id else None
        eff = effective_status(r, now)
        items.append(
            ComplianceRecordOut(
                id=r.id,
                company_id=r.company_id,
                user_id=r.user_id,
                user_name=u.full_name if u else None,
                user_role=primary_jwt_role(u).value if u else None,
                tool_id=r.tool_id,
                tool_name=t.name if t else None,
                sop_id=r.sop_id,
                sop_label=r.sop_label,
                category=r.category.value if hasattr(r.category, "value") else str(r.category),
                status=r.status.value if hasattr(r.status, "value") else str(r.status),
                effective_status=eff,
                ignored=r.ignored,
                flagged=r.flagged,
                required_at=r.required_at,
                completed_at=r.completed_at,
                reviewed_at=r.reviewed_at,
                repeat_offender=r.user_id in repeat_ids,
                created_at=r.created_at,
            )
        )

    if sort == "status":
        order_map = {"ignored": 0, "overdue": 1, "pending": 2, "completed": 3}

        def sort_key(x: ComplianceRecordOut) -> tuple:
            primary = order_map.get(x.effective_status, 9)
            t_cmp = x.required_at.timestamp()
            return (primary, -t_cmp if order_dir == "desc" else t_cmp)

        items.sort(key=sort_key)

    return ComplianceListOut(items=items, total=total)


async def _get_record(db: AsyncSession, cid: str, record_id: str) -> ComplianceRecord:
    row = await db.get(ComplianceRecord, record_id)
    if not row or row.company_id != cid:
        raise HTTPException(status_code=404, detail="Compliance record not found")
    return row


async def _org_module_settings_merged(db: AsyncSession, cid: str) -> dict:
    q = await db.execute(select(PulseOrgModuleSettings).where(PulseOrgModuleSettings.company_id == cid))
    row = q.scalar_one_or_none()
    return merge_org_module_settings(row.settings if row else None)


@router.post("/{record_id}/review", status_code=status.HTTP_204_NO_CONTENT)
async def mark_reviewed(
    db: Db,
    user: ManagerUser,
    cid: CompanyId,
    record_id: str,
) -> None:
    row = await _get_record(db, cid, record_id)
    row.reviewed_at = datetime.now(timezone.utc)
    row.reviewed_by_user_id = user.id
    await db.commit()


@router.post("/{record_id}/resend", status_code=status.HTTP_204_NO_CONTENT)
async def resend_acknowledgment(
    db: Db,
    user: ManagerUser,
    cid: CompanyId,
    record_id: str,
) -> None:
    _ = user
    row = await _get_record(db, cid, record_id)
    rule = None
    if row.tool_id:
        rq = await db.execute(
            select(ComplianceRule).where(
                ComplianceRule.company_id == cid,
                ComplianceRule.tool_id == row.tool_id,
            )
        )
        rule = rq.scalar_one_or_none()
    hours = int(rule.time_limit_hours) if rule else 24
    row.required_at = datetime.now(timezone.utc) + timedelta(hours=hours)
    row.ignored = False
    await db.commit()


@router.post("/{record_id}/flag", status_code=status.HTTP_204_NO_CONTENT)
async def flag_record(
    db: Db,
    user: ManagerUser,
    cid: CompanyId,
    record_id: str,
    body: ComplianceFlagBody,
) -> None:
    org = await _org_module_settings_merged(db, cid)
    comp = org.get("compliance") or {}
    if comp.get("requireManagerForEscalation"):
        if not user_has_any_role(
            user,
            UserRole.system_admin,
            UserRole.company_admin,
            UserRole.manager,
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only managers and company administrators may flag compliance records",
            )
    row = await _get_record(db, cid, record_id)
    row.flagged = body.flagged
    await db.commit()
