"""Phase 1 personal command center service."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.ops_command_models import (
    OpsAuthorityMatrixRow,
    OpsChecklistInstance,
    OpsChecklistItem,
    OpsChecklistTemplate,
    OpsKnowledgeGap,
    OpsPersonalProfile,
    OpsRoleResponsibility,
)

DEFAULT_PRINCIPLES = [
    "Safety before production",
    "Reliability before reaction",
    "Standardize repeated work",
    "Document institutional knowledge",
    "Involve the people doing the work",
    "Fix systems, not just symptoms",
    "Use evidence to make decisions",
    "Treat public assets as long-term investments",
    "Communicate early",
    "Continuously improve",
]

DEFAULT_AUTHORITY_DECISIONS = [
    "Routine maintenance",
    "Emergency shutdown",
    "Contractor callout",
    "Purchasing",
    "Overtime",
    "Facility closure",
    "Capital projects",
]

PHILOSOPHY_KEYS = [
    "leadership",
    "safety",
    "maintenance",
    "asset_management",
    "customer_service",
    "continuous_improvement",
    "decision_making",
]

SYSTEM_TEMPLATES: list[dict[str, Any]] = [
    {
        "slug": "first-30-days",
        "title": "First 30 Days",
        "description": "Onboarding checklist — understand people, facilities, assets, safety, and open questions.",
        "category": "onboarding",
        "structure": [
            {"title": "People", "items": ["Meet direct reports", "Meet manager and peers", "Map key contacts"]},
            {"title": "Facilities", "items": ["Tour primary facilities", "Note critical systems", "Locate drawings and keys"]},
            {"title": "Assets", "items": ["Review critical assets", "Identify PM gaps", "Find spare-parts dependencies"]},
            {"title": "Safety", "items": ["Review emergency procedures", "Confirm PPE expectations", "Locate SDS / chemical storage"]},
            {"title": "Compliance", "items": ["List regulatory inspections", "Confirm certification requirements"]},
            {"title": "Budget", "items": ["Confirm purchasing authority", "Review overtime process"]},
            {"title": "Projects", "items": ["List active projects", "Identify upcoming milestones"]},
            {"title": "Contractors", "items": ["Preferred vendors list", "Emergency callout process"]},
            {"title": "Systems", "items": ["CMMS / City software access", "Document system ownership"]},
            {"title": "Documentation", "items": ["Locate SOP library", "Identify missing procedures"]},
            {"title": "Questions for Manager", "items": ["Escalation paths", "Decision authority", "Priorities for first 90 days"]},
            {"title": "Knowledge Gaps", "items": ["Capture open questions in Knowledge Gaps module"]},
        ],
    },
    {
        "slug": "first-90-days",
        "title": "First 90 Days",
        "description": "Stabilize operations — people, maintenance, assets, inventory, compliance, and process improvement.",
        "category": "onboarding",
        "structure": [
            {"title": "People", "items": ["1:1 cadence established", "Cross-training gaps identified"]},
            {"title": "Operations", "items": ["Daily/weekly rhythm defined", "Communication channels clear"]},
            {"title": "Maintenance", "items": ["PM backlog reviewed", "Reactive vs planned ratio understood"]},
            {"title": "Assets", "items": ["Criticality list agreed", "Condition hotspots documented"]},
            {"title": "Inventory", "items": ["Critical spares status", "Below-minimum items flagged"]},
            {"title": "Compliance", "items": ["Inspection calendar current", "Training overdue addressed"]},
            {"title": "Projects", "items": ["Project risks logged", "Decisions escalated"]},
            {"title": "Budget", "items": ["Spend vs plan visibility", "Capital candidates listed"]},
            {"title": "Team development", "items": ["Skill gaps noted", "Development goals drafted"]},
            {"title": "Process improvement", "items": ["Top recurring problems listed", "One system fix started"]},
        ],
    },
    {
        "slug": "first-year",
        "title": "First Year",
        "description": "Q1 Understand → Q2 Stabilize → Q3 Standardize → Q4 Improve.",
        "category": "onboarding",
        "structure": [
            {"title": "Q1 — Understand", "items": ["Org map complete", "Authority matrix confirmed", "Critical assets known"]},
            {"title": "Q2 — Stabilize", "items": ["PM reliability improving", "Staffing risks mitigated", "SOP gaps closed"]},
            {"title": "Q3 — Standardize", "items": ["Repeatable weekly reviews", "Documented escalations", "Training matrix current"]},
            {"title": "Q4 — Improve", "items": ["Process improvements delivered", "Team development progress", "Year-2 priorities drafted"]},
        ],
    },
    {
        "slug": "arena-freeze-up",
        "title": "Arena freeze-up / ice plant startup",
        "description": "Seasonal ice plant startup and freeze-up checklist — internal operations, not a code inspection.",
        "category": "seasonal",
        "structure": [
            {
                "title": "Safety & access",
                "items": [
                    "Confirm plant-room access, lighting, and posted internal emergency card",
                    "Locate ammonia / plant emergency shutoffs you are trained to use",
                    "Confirm refrigeration contractor after-hours number is current",
                    "PPE and leak-detection tools available",
                ],
            },
            {
                "title": "Ice plant",
                "items": [
                    "Walk the plant: unusual noise, vibration, oil, frost, alarms",
                    "Confirm leak detection is powered and not in fault (internal check)",
                    "Review last contractor visit and open work requests",
                    "Record brine / chilled-system observations from a safe location",
                ],
            },
            {
                "title": "Ice sheet & resurfacer",
                "items": [
                    "Ice thickness / freeze-up plan documented for this season",
                    "Ice resurfacer fluids, blade, and safety devices checked",
                    "Snow pit / melt pit clear and pumps ready",
                ],
            },
            {
                "title": "Building",
                "items": [
                    "Spectator and player areas ready for ice season",
                    "AED cabinet checked",
                    "Power-failure and fire internal procedures reviewed with staff on shift",
                ],
            },
        ],
    },
    {
        "slug": "pool-open",
        "title": "Pool open / aquatic startup",
        "description": "Seasonal aquatic startup — circulation, chemistry, and deck emergency equipment. Internal checklist.",
        "category": "seasonal",
        "structure": [
            {
                "title": "Mechanical",
                "items": [
                    "Circulation pumps primed and running without obvious leaks",
                    "Strainers and filters in service condition",
                    "Chemical controller powered; probes in place",
                    "Review open work requests on pumps / controller",
                ],
            },
            {
                "title": "Water quality",
                "items": [
                    "Baseline chemistry recorded against operating targets",
                    "Fill / makeup water and known leak points checked",
                    "SDS accessible in the chemical room",
                ],
            },
            {
                "title": "Deck emergency",
                "items": [
                    "AED present and pads in date",
                    "Spinal board / rescue equipment in place",
                    "Internal drowning / pool emergency card reviewed",
                    "Lifeguard certifications on file (expiry blank until staff added)",
                ],
            },
            {
                "title": "Startup communications",
                "items": [
                    "Pool equipment vendor placeholder updated or confirmed",
                    "Coordinator notified of remaining incomplete items",
                ],
            },
        ],
    },
    {
        "slug": "playground-seasonal",
        "title": "Playground seasonal review",
        "description": "Optional seasonal playground walk — surfacing, hardware, drainage, signage. Internal review.",
        "category": "seasonal",
        "structure": [
            {
                "title": "Site",
                "items": [
                    "Surfacing even, drained, and free of standing hazards",
                    "Hardware tight; no sharp edges or broken parts noted",
                    "Signage and age labels readable",
                    "Create work requests for anything that failed this walk",
                ],
            }
        ],
    },
]


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _instance_progress(items: list[OpsChecklistItem]) -> int:
    if not items:
        return 0
    done = sum(1 for i in items if i.completed)
    return int(round(100 * done / len(items)))


async def ensure_system_templates(db: AsyncSession) -> None:
    from sqlalchemy import text

    admin = "true"
    try:
        admin = str(
            (await db.execute(text("SELECT coalesce(current_setting('pulse.is_system_admin', true), '')"))).scalar()
            or ""
        )
    except Exception:
        admin = ""
    # Under pulse_app + FORCE RLS, NULL company_id catalog rows need system context.
    # Skip inserts when the request is a tenant session (`false`); still insert when unset (tests/superuser).
    if admin.lower() == "false":
        return
    for tpl in SYSTEM_TEMPLATES:
        existing = (
            await db.execute(
                select(OpsChecklistTemplate).where(
                    OpsChecklistTemplate.slug == tpl["slug"],
                    OpsChecklistTemplate.is_system.is_(True),
                )
            )
        ).scalar_one_or_none()
        if existing:
            continue
        structure = []
        for sec in tpl["structure"]:
            structure.append(
                {
                    "id": str(uuid4()),
                    "title": sec["title"],
                    "items": [{"id": str(uuid4()), "title": t} for t in sec["items"]],
                }
            )
        db.add(
            OpsChecklistTemplate(
                company_id=None,
                slug=tpl["slug"],
                title=tpl["title"],
                description=tpl["description"],
                category=tpl["category"],
                structure=structure,
                is_system=True,
            )
        )
    await db.flush()


async def get_or_create_profile(db: AsyncSession, company_id: str, user_id: str) -> OpsPersonalProfile:
    row = (
        await db.execute(
            select(OpsPersonalProfile).where(
                OpsPersonalProfile.company_id == company_id,
                OpsPersonalProfile.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if row:
        return row
    row = OpsPersonalProfile(
        company_id=company_id,
        user_id=user_id,
        principles=list(DEFAULT_PRINCIPLES),
        philosophy={k: "" for k in PHILOSOPHY_KEYS},
    )
    db.add(row)
    await db.flush()
    # Seed default authority rows
    for i, decision in enumerate(DEFAULT_AUTHORITY_DECISIONS):
        db.add(
            OpsAuthorityMatrixRow(
                company_id=company_id,
                user_id=user_id,
                decision=decision,
                levels={"staff": False, "coordinator": False, "manager": False, "director": False},
                status="unknown",
                sort_order=i,
            )
        )
    await db.flush()
    return row


async def patch_profile(
    db: AsyncSession, company_id: str, user_id: str, data: dict[str, Any]
) -> OpsPersonalProfile:
    row = await get_or_create_profile(db, company_id, user_id)
    for k, v in data.items():
        if hasattr(row, k) and k not in {"id", "company_id", "user_id", "created_at"}:
            setattr(row, k, v)
    await db.flush()
    return row


async def list_responsibilities(db: AsyncSession, company_id: str, user_id: str) -> list[OpsRoleResponsibility]:
    stmt = (
        select(OpsRoleResponsibility)
        .where(OpsRoleResponsibility.company_id == company_id, OpsRoleResponsibility.user_id == user_id)
        .order_by(OpsRoleResponsibility.sort_order, OpsRoleResponsibility.category, OpsRoleResponsibility.title)
    )
    return list((await db.execute(stmt)).scalars().all())


async def create_responsibility(
    db: AsyncSession, company_id: str, user_id: str, data: dict[str, Any]
) -> OpsRoleResponsibility:
    row = OpsRoleResponsibility(company_id=company_id, user_id=user_id, **data)
    db.add(row)
    await db.flush()
    return row


async def patch_responsibility(
    db: AsyncSession, company_id: str, user_id: str, row_id: str, data: dict[str, Any]
) -> OpsRoleResponsibility | None:
    row = (
        await db.execute(
            select(OpsRoleResponsibility).where(
                OpsRoleResponsibility.company_id == company_id,
                OpsRoleResponsibility.user_id == user_id,
                OpsRoleResponsibility.id == row_id,
            )
        )
    ).scalar_one_or_none()
    if not row:
        return None
    for k, v in data.items():
        if hasattr(row, k):
            setattr(row, k, v)
    await db.flush()
    return row


async def delete_responsibility(db: AsyncSession, company_id: str, user_id: str, row_id: str) -> bool:
    row = (
        await db.execute(
            select(OpsRoleResponsibility).where(
                OpsRoleResponsibility.company_id == company_id,
                OpsRoleResponsibility.user_id == user_id,
                OpsRoleResponsibility.id == row_id,
            )
        )
    ).scalar_one_or_none()
    if not row:
        return False
    await db.delete(row)
    await db.flush()
    return True


async def list_authority(db: AsyncSession, company_id: str, user_id: str) -> list[OpsAuthorityMatrixRow]:
    stmt = (
        select(OpsAuthorityMatrixRow)
        .where(OpsAuthorityMatrixRow.company_id == company_id, OpsAuthorityMatrixRow.user_id == user_id)
        .order_by(OpsAuthorityMatrixRow.sort_order, OpsAuthorityMatrixRow.decision)
    )
    return list((await db.execute(stmt)).scalars().all())


async def create_authority(
    db: AsyncSession, company_id: str, user_id: str, data: dict[str, Any]
) -> OpsAuthorityMatrixRow:
    row = OpsAuthorityMatrixRow(company_id=company_id, user_id=user_id, **data)
    db.add(row)
    await db.flush()
    return row


async def patch_authority(
    db: AsyncSession, company_id: str, user_id: str, row_id: str, data: dict[str, Any]
) -> OpsAuthorityMatrixRow | None:
    row = (
        await db.execute(
            select(OpsAuthorityMatrixRow).where(
                OpsAuthorityMatrixRow.company_id == company_id,
                OpsAuthorityMatrixRow.user_id == user_id,
                OpsAuthorityMatrixRow.id == row_id,
            )
        )
    ).scalar_one_or_none()
    if not row:
        return None
    for k, v in data.items():
        if hasattr(row, k):
            setattr(row, k, v)
    await db.flush()
    return row


async def delete_authority(db: AsyncSession, company_id: str, user_id: str, row_id: str) -> bool:
    row = (
        await db.execute(
            select(OpsAuthorityMatrixRow).where(
                OpsAuthorityMatrixRow.company_id == company_id,
                OpsAuthorityMatrixRow.user_id == user_id,
                OpsAuthorityMatrixRow.id == row_id,
            )
        )
    ).scalar_one_or_none()
    if not row:
        return False
    await db.delete(row)
    await db.flush()
    return True


async def list_templates(db: AsyncSession, company_id: str) -> list[OpsChecklistTemplate]:
    await ensure_system_templates(db)
    stmt = select(OpsChecklistTemplate).where(
        or_(
            OpsChecklistTemplate.is_system.is_(True),
            OpsChecklistTemplate.company_id == company_id,
        )
    )
    return list((await db.execute(stmt)).scalars().all())


async def list_instances(db: AsyncSession, company_id: str, user_id: str) -> list[OpsChecklistInstance]:
    stmt = (
        select(OpsChecklistInstance)
        .where(OpsChecklistInstance.company_id == company_id, OpsChecklistInstance.user_id == user_id)
        .options(selectinload(OpsChecklistInstance.items))
        .order_by(OpsChecklistInstance.updated_at.desc())
    )
    return list((await db.execute(stmt)).scalars().all())


async def get_instance(
    db: AsyncSession, company_id: str, user_id: str, instance_id: str
) -> OpsChecklistInstance | None:
    stmt = (
        select(OpsChecklistInstance)
        .where(
            OpsChecklistInstance.company_id == company_id,
            OpsChecklistInstance.user_id == user_id,
            OpsChecklistInstance.id == instance_id,
        )
        .options(selectinload(OpsChecklistInstance.items))
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def start_checklist(
    db: AsyncSession,
    company_id: str,
    user_id: str,
    *,
    template_slug: Optional[str] = None,
    template_id: Optional[str] = None,
    title: Optional[str] = None,
    due_date: Optional[date] = None,
    priority: str = "medium",
    facility_id: Optional[str] = None,
    season_year: Optional[int] = None,
) -> OpsChecklistInstance:
    await ensure_system_templates(db)
    tpl: OpsChecklistTemplate | None = None
    if template_id:
        tpl = (
            await db.execute(select(OpsChecklistTemplate).where(OpsChecklistTemplate.id == template_id))
        ).scalar_one_or_none()
    elif template_slug:
        tpl = (
            await db.execute(
                select(OpsChecklistTemplate).where(OpsChecklistTemplate.slug == template_slug)
            )
        ).scalar_one_or_none()
    if not tpl and not title:
        raise ValueError("template_slug, template_id, or title is required")

    instance_title = title or (tpl.title if tpl else "Checklist")
    if tpl and tpl.category == "seasonal" and season_year:
        instance_title = f"{tpl.title} — {season_year}"

    instance = OpsChecklistInstance(
        company_id=company_id,
        user_id=user_id,
        template_id=str(tpl.id) if tpl else None,
        title=instance_title,
        description=tpl.description if tpl else None,
        category=tpl.category if tpl else "personal",
        priority=priority,
        due_date=due_date,
        status="active",
        facility_id=facility_id,
        season_year=season_year,
    )
    db.add(instance)
    await db.flush()

    sort = 0
    if tpl:
        for sec in tpl.structure or []:
            section_title = sec.get("title") or "General"
            for item in sec.get("items") or []:
                if isinstance(item, str):
                    title = item
                    description = None
                else:
                    title = str(item.get("title") or "Item")
                    description = item.get("description")
                db.add(
                    OpsChecklistItem(
                        company_id=company_id,
                        instance_id=str(instance.id),
                        section=section_title,
                        title=title[:512],
                        description=description,
                        sort_order=sort,
                    )
                )
                sort += 1
    await db.flush()
    return await get_instance(db, company_id, user_id, str(instance.id))  # type: ignore[return-value]


async def patch_checklist_item(
    db: AsyncSession,
    company_id: str,
    user_id: str,
    item_id: str,
    data: dict[str, Any],
) -> OpsChecklistItem | None:
    item = (
        await db.execute(
            select(OpsChecklistItem)
            .join(OpsChecklistInstance)
            .where(
                OpsChecklistItem.id == item_id,
                OpsChecklistItem.company_id == company_id,
                OpsChecklistInstance.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if not item:
        return None
    if "completed" in data and data["completed"] is not None:
        item.completed = bool(data["completed"])
        item.completed_at = _utcnow() if item.completed else None
    for k in ("due_date", "priority", "notes", "title", "description", "section"):
        if k in data and data[k] is not None:
            setattr(item, k, data[k])
    await db.flush()
    return item


async def delete_instance(db: AsyncSession, company_id: str, user_id: str, instance_id: str) -> bool:
    row = await get_instance(db, company_id, user_id, instance_id)
    if not row:
        return False
    await db.delete(row)
    await db.flush()
    return True


async def list_gaps(
    db: AsyncSession,
    company_id: str,
    user_id: str,
    *,
    status: Optional[str] = None,
    q: Optional[str] = None,
) -> list[OpsKnowledgeGap]:
    stmt = select(OpsKnowledgeGap).where(
        OpsKnowledgeGap.company_id == company_id, OpsKnowledgeGap.user_id == user_id
    )
    if status:
        stmt = stmt.where(OpsKnowledgeGap.status == status)
    if q and q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(OpsKnowledgeGap.question.ilike(like), OpsKnowledgeGap.answer.ilike(like)))
    stmt = stmt.order_by(OpsKnowledgeGap.updated_at.desc())
    return list((await db.execute(stmt)).scalars().all())


async def create_gap(db: AsyncSession, company_id: str, user_id: str, data: dict[str, Any]) -> OpsKnowledgeGap:
    row = OpsKnowledgeGap(company_id=company_id, user_id=user_id, **data)
    db.add(row)
    await db.flush()
    return row


async def patch_gap(
    db: AsyncSession, company_id: str, user_id: str, gap_id: str, data: dict[str, Any]
) -> OpsKnowledgeGap | None:
    row = (
        await db.execute(
            select(OpsKnowledgeGap).where(
                OpsKnowledgeGap.company_id == company_id,
                OpsKnowledgeGap.user_id == user_id,
                OpsKnowledgeGap.id == gap_id,
            )
        )
    ).scalar_one_or_none()
    if not row:
        return None
    for k, v in data.items():
        if hasattr(row, k):
            setattr(row, k, v)
    await db.flush()
    return row


async def delete_gap(db: AsyncSession, company_id: str, user_id: str, gap_id: str) -> bool:
    row = (
        await db.execute(
            select(OpsKnowledgeGap).where(
                OpsKnowledgeGap.company_id == company_id,
                OpsKnowledgeGap.user_id == user_id,
                OpsKnowledgeGap.id == gap_id,
            )
        )
    ).scalar_one_or_none()
    if not row:
        return False
    await db.delete(row)
    await db.flush()
    return True


async def dashboard_summary(db: AsyncSession, company_id: str, user_id: str) -> dict[str, Any]:
    today = date.today()
    profile = await get_or_create_profile(db, company_id, user_id)
    instances = await list_instances(db, company_id, user_id)
    gaps = await list_gaps(db, company_id, user_id)
    authority = await list_authority(db, company_id, user_id)

    due_items: list[dict[str, Any]] = []
    overdue = 0
    due_today = 0
    open_items = 0
    for inst in instances:
        if inst.status != "active":
            continue
        for item in inst.items:
            if item.completed:
                continue
            open_items += 1
            if item.due_date and item.due_date < today:
                overdue += 1
                due_items.append(
                    {
                        "kind": "checklist",
                        "priority": "critical" if item.priority == "high" else "high",
                        "title": item.title,
                        "section": item.section,
                        "checklist": inst.title,
                        "due_date": item.due_date.isoformat(),
                        "href": f"/recreation/checklists?id={inst.id}",
                    }
                )
            elif item.due_date == today:
                due_today += 1
                due_items.append(
                    {
                        "kind": "checklist",
                        "priority": "high",
                        "title": item.title,
                        "section": item.section,
                        "checklist": inst.title,
                        "due_date": item.due_date.isoformat(),
                        "href": f"/recreation/checklists?id={inst.id}",
                    }
                )

    open_gaps = [g for g in gaps if g.status in {"open", "asked", "needs_review"}]
    high_gaps = [g for g in open_gaps if g.priority in {"high", "urgent"}]
    for g in high_gaps[:8]:
        due_items.append(
            {
                "kind": "knowledge_gap",
                "priority": "high" if g.priority == "high" else "critical",
                "title": g.question[:120],
                "category": g.category,
                "status": g.status,
                "href": f"/recreation/knowledge-gaps?id={g.id}",
            }
        )

    active = [i for i in instances if i.status == "active"]
    summaries = [
        {
            "id": str(i.id),
            "title": i.title,
            "progress_pct": _instance_progress(list(i.items)),
            "item_count": len(i.items),
            "completed": sum(1 for x in i.items if x.completed),
            "due_date": i.due_date.isoformat() if i.due_date else None,
        }
        for i in active[:6]
    ]

    profile_complete = bool(
        profile.display_name and profile.position and profile.role_purpose and (profile.principles or [])
    )

    return {
        "checklist_due_today": due_today,
        "checklist_overdue": overdue,
        "checklist_open_items": open_items,
        "active_checklists": len(active),
        "knowledge_gaps_open": len(open_gaps),
        "knowledge_gaps_high": len(high_gaps),
        "authority_unknown": sum(1 for a in authority if a.status in {"unknown", "need_to_confirm"}),
        "profile_complete": profile_complete,
        "due_items": due_items[:20],
        "open_gaps": [
            {
                "id": str(g.id),
                "question": g.question,
                "category": g.category,
                "priority": g.priority,
                "status": g.status,
            }
            for g in open_gaps[:10]
        ],
        "active_checklist_summaries": summaries,
    }


def serialize_instance(row: OpsChecklistInstance) -> dict[str, Any]:
    items = list(row.items or [])
    return {
        "id": str(row.id),
        "company_id": str(row.company_id),
        "user_id": str(row.user_id),
        "template_id": str(row.template_id) if row.template_id else None,
        "title": row.title,
        "description": row.description,
        "category": row.category,
        "priority": row.priority,
        "status": row.status,
        "due_date": row.due_date,
        "notes": row.notes,
        "facility_id": str(row.facility_id) if getattr(row, "facility_id", None) else None,
        "season_year": getattr(row, "season_year", None),
        "created_at": row.created_at,
        "updated_at": row.updated_at,
        "items": items,
        "progress_pct": _instance_progress(items),
        "incomplete_items": [
            {"id": str(i.id), "title": i.title, "section": i.section}
            for i in items
            if not i.completed
        ],
    }
