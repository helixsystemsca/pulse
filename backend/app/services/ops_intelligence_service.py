"""Phase 3 operational intelligence — aggregate attention from existing CMMS modules.

Does not create parallel asset/inventory/training systems. Soft-fails per domain
when tables are empty or a query fails so Command Center stays usable.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


def _item(
    *,
    kind: str,
    title: str,
    priority: str = "medium",
    href: str,
    detail: Optional[str] = None,
) -> dict[str, Any]:
    return {
        "kind": kind,
        "title": title,
        "priority": priority,
        "href": href,
        "detail": detail,
    }


async def _safe(label: str, coro) -> Any:
    try:
        return await coro
    except Exception:
        logger.exception("ops intelligence: %s failed", label)
        return None


async def _assets_attention(db: AsyncSession, company_id: str) -> dict[str, Any]:
    from app.models.domain import EquipmentPart, FacilityEquipment, FacilityEquipmentStatus

    today = datetime.now(timezone.utc).date()
    due_end = today + timedelta(days=14)

    overdue_sum = func.coalesce(
        func.sum(case((EquipmentPart.next_replacement_date < today, 1), else_=0)),
        0,
    )
    due_soon_sum = func.coalesce(
        func.sum(
            case(
                (
                    and_(
                        EquipmentPart.next_replacement_date.isnot(None),
                        EquipmentPart.next_replacement_date >= today,
                        EquipmentPart.next_replacement_date <= due_end,
                    ),
                    1,
                ),
                else_=0,
            )
        ),
        0,
    )
    part_stmt = (
        select(EquipmentPart.equipment_id, overdue_sum, due_soon_sum)
        .where(
            EquipmentPart.company_id == company_id,
            EquipmentPart.next_replacement_date.isnot(None),
        )
        .group_by(EquipmentPart.equipment_id)
    )
    counts = {
        str(r[0]): (int(r[1] or 0), int(r[2] or 0))
        for r in (await db.execute(part_stmt)).all()
    }

    eq_rows = list(
        (
            await db.execute(
                select(FacilityEquipment).where(FacilityEquipment.company_id == company_id).limit(500)
            )
        )
        .scalars()
        .all()
    )

    overdue_equip = 0
    due_soon_equip = 0
    maintenance = 0
    items: list[dict[str, Any]] = []
    for eq in eq_rows:
        po, ps = counts.get(str(eq.id), (0, 0))
        st = eq.status.value if hasattr(eq.status, "value") else str(eq.status)
        if st == FacilityEquipmentStatus.maintenance.value or st == "maintenance":
            maintenance += 1
        if po > 0:
            overdue_equip += 1
            if len(items) < 8:
                items.append(
                    _item(
                        kind="asset",
                        title=eq.name,
                        priority="critical",
                        href=f"/equipment/{eq.id}",
                        detail=f"{po} part(s) overdue PM",
                    )
                )
        elif ps > 0:
            due_soon_equip += 1
            if len(items) < 8:
                items.append(
                    _item(
                        kind="asset",
                        title=eq.name,
                        priority="high",
                        href=f"/equipment/{eq.id}",
                        detail=f"{ps} part(s) due soon",
                    )
                )

    return {
        "available": True,
        "equipment_pm_overdue": overdue_equip,
        "equipment_pm_due_soon": due_soon_equip,
        "equipment_in_maintenance": maintenance,
        "items": items,
    }


async def _inventory_attention(db: AsyncSession, company_id: str) -> dict[str, Any]:
    from app.models.domain import InventoryItem

    stmt = (
        select(InventoryItem)
        .where(
            InventoryItem.company_id == company_id,
            InventoryItem.quantity <= InventoryItem.low_stock_threshold,
        )
        .order_by(InventoryItem.name)
        .limit(20)
    )
    rows = list((await db.execute(stmt)).scalars().all())
    items = [
        _item(
            kind="inventory",
            title=r.name,
            priority="critical" if float(r.quantity or 0) <= 0 else "high",
            href="/dashboard/inventory",
            detail=f"Qty {r.quantity} / min {r.low_stock_threshold}",
        )
        for r in rows[:8]
    ]
    return {
        "available": True,
        "low_stock_count": len(rows) if len(rows) < 20 else int(
            (
                await db.execute(
                    select(func.count())
                    .select_from(InventoryItem)
                    .where(
                        InventoryItem.company_id == company_id,
                        InventoryItem.quantity <= InventoryItem.low_stock_threshold,
                    )
                )
            ).scalar_one()
            or 0
        ),
        "items": items,
    }


async def _procedures_attention(db: AsyncSession, company_id: str) -> dict[str, Any]:
    from app.models.pulse_models import PulseProcedure

    total = int(
        (
            await db.execute(
                select(func.count())
                .select_from(PulseProcedure)
                .where(PulseProcedure.company_id == company_id, PulseProcedure.is_active.is_(True))
            )
        ).scalar_one()
        or 0
    )
    critical = int(
        (
            await db.execute(
                select(func.count())
                .select_from(PulseProcedure)
                .where(
                    PulseProcedure.company_id == company_id,
                    PulseProcedure.is_active.is_(True),
                    PulseProcedure.is_critical.is_(True),
                )
            )
        ).scalar_one()
        or 0
    )
    crit_rows = list(
        (
            await db.execute(
                select(PulseProcedure)
                .where(
                    PulseProcedure.company_id == company_id,
                    PulseProcedure.is_active.is_(True),
                    PulseProcedure.is_critical.is_(True),
                )
                .order_by(PulseProcedure.title)
                .limit(8)
            )
        )
        .scalars()
        .all()
    )
    items = [
        _item(
            kind="procedure",
            title=p.title,
            priority="high",
            href="/standards/procedures",
            detail="Critical SOP",
        )
        for p in crit_rows
    ]
    return {
        "available": True,
        "active_count": total,
        "critical_count": critical,
        "items": items,
    }


async def _training_attention(db: AsyncSession, company_id: str) -> dict[str, Any]:
    from app.models.pulse_models import PulseProcedureTrainingAssignment

    today = date.today()
    overdue_q = await db.execute(
        select(func.count())
        .select_from(PulseProcedureTrainingAssignment)
        .where(
            PulseProcedureTrainingAssignment.company_id == company_id,
            PulseProcedureTrainingAssignment.completed_at.is_(None),
            PulseProcedureTrainingAssignment.due_date.isnot(None),
            PulseProcedureTrainingAssignment.due_date < today,
        )
    )
    overdue = int(overdue_q.scalar_one() or 0)

    expired_q = await db.execute(
        select(func.count())
        .select_from(PulseProcedureTrainingAssignment)
        .where(
            PulseProcedureTrainingAssignment.company_id == company_id,
            PulseProcedureTrainingAssignment.expiry_date.isnot(None),
            PulseProcedureTrainingAssignment.expiry_date < today,
        )
    )
    expired = int(expired_q.scalar_one() or 0)

    due_soon_q = await db.execute(
        select(func.count())
        .select_from(PulseProcedureTrainingAssignment)
        .where(
            PulseProcedureTrainingAssignment.company_id == company_id,
            PulseProcedureTrainingAssignment.completed_at.is_(None),
            PulseProcedureTrainingAssignment.due_date.isnot(None),
            PulseProcedureTrainingAssignment.due_date >= today,
            PulseProcedureTrainingAssignment.due_date <= today + timedelta(days=14),
        )
    )
    due_soon = int(due_soon_q.scalar_one() or 0)

    items: list[dict[str, Any]] = []
    if overdue:
        items.append(
            _item(
                kind="training",
                title=f"{overdue} training assignment(s) overdue",
                priority="critical",
                href="/training/compliance/matrix",
                detail="Open the compliance matrix",
            )
        )
    if expired:
        items.append(
            _item(
                kind="training",
                title=f"{expired} assignment(s) expired",
                priority="high",
                href="/training/compliance/matrix",
            )
        )
    if due_soon:
        items.append(
            _item(
                kind="training",
                title=f"{due_soon} assignment(s) due within 14 days",
                priority="medium",
                href="/training/compliance/matrix",
            )
        )

    return {
        "available": True,
        "overdue_count": overdue,
        "expired_count": expired,
        "due_soon_count": due_soon,
        "items": items,
    }


async def _compliance_attention(db: AsyncSession, company_id: str) -> dict[str, Any]:
    from app.modules.compliance import service as compliance_svc

    data = await compliance_svc.summarize(db, company_id)
    missed = int(data.get("missed_count") or 0)
    high_risk = int(data.get("high_risk_count") or 0)
    rate = float(data.get("compliance_rate") or 100.0)
    items: list[dict[str, Any]] = []
    if missed:
        items.append(
            _item(
                kind="compliance",
                title=f"{missed} missed / overdue compliance item(s)",
                priority="critical" if high_risk else "high",
                href="/standards/compliance",
                detail=f"Rate {rate:.0f}% · high risk {high_risk}",
            )
        )
    return {
        "available": True,
        "missed_count": missed,
        "high_risk_count": high_risk,
        "compliance_rate": rate,
        "items": items,
    }


async def _emergency_attention(db: AsyncSession, company_id: str) -> dict[str, Any]:
    from app.models.ops_foundation_models import OpsContact, OpsFacility, OpsKnowledgeArticle

    facilities = list(
        (
            await db.execute(
                select(OpsFacility).where(
                    OpsFacility.company_id == company_id,
                    OpsFacility.status != "archived",
                    OpsFacility.emergency_procedures.isnot(None),
                    OpsFacility.emergency_procedures != "",
                )
            )
        )
        .scalars()
        .all()
    )
    contacts = int(
        (
            await db.execute(
                select(func.count())
                .select_from(OpsContact)
                .where(
                    OpsContact.company_id == company_id,
                    OpsContact.contact_type == "emergency",
                    OpsContact.status != "archived",
                )
            )
        ).scalar_one()
        or 0
    )
    knowledge = int(
        (
            await db.execute(
                select(func.count())
                .select_from(OpsKnowledgeArticle)
                .where(
                    OpsKnowledgeArticle.company_id == company_id,
                    OpsKnowledgeArticle.category == "Emergency Procedures",
                    OpsKnowledgeArticle.status != "archived",
                )
            )
        ).scalar_one()
        or 0
    )
    items = [
        _item(
            kind="emergency",
            title=f.title,
            priority="high",
            href="/recreation/emergency",
            detail="Facility emergency procedures on file",
        )
        for f in facilities[:6]
    ]
    gaps = []
    if not facilities:
        gaps.append("No facility emergency procedures documented")
    if contacts == 0:
        gaps.append("No emergency contacts in ops directory")
    if knowledge == 0:
        gaps.append("No Emergency Procedures knowledge articles")

    return {
        "available": True,
        "facilities_with_procedures": len(facilities),
        "emergency_contacts": contacts,
        "emergency_knowledge_articles": knowledge,
        "readiness_gaps": gaps,
        "items": items,
    }


async def _projects_attention(db: AsyncSession, company_id: str) -> dict[str, Any]:
    from app.models.pulse_models import PulseProject, PulseProjectStatus, PulseProjectTask, PulseTaskStatus
    from app.models.roadmap_models import RoadmapProject

    today = date.today()
    active_statuses = [PulseProjectStatus.active, PulseProjectStatus.future, PulseProjectStatus.on_hold]
    active_n = int(
        (
            await db.execute(
                select(func.count())
                .select_from(PulseProject)
                .where(
                    PulseProject.company_id == company_id,
                    PulseProject.status.in_(active_statuses),
                )
            )
        ).scalar_one()
        or 0
    )

    overdue_tasks = list(
        (
            await db.execute(
                select(PulseProjectTask, PulseProject.name)
                .join(PulseProject, PulseProject.id == PulseProjectTask.project_id)
                .where(
                    PulseProjectTask.company_id == company_id,
                    PulseProjectTask.status != PulseTaskStatus.complete,
                    PulseProjectTask.due_date.isnot(None),
                    PulseProjectTask.due_date < today,
                    PulseProject.status.in_(active_statuses),
                )
                .order_by(PulseProjectTask.due_date.asc())
                .limit(12)
            )
        ).all()
    )
    overdue_n = int(
        (
            await db.execute(
                select(func.count())
                .select_from(PulseProjectTask)
                .join(PulseProject, PulseProject.id == PulseProjectTask.project_id)
                .where(
                    PulseProjectTask.company_id == company_id,
                    PulseProjectTask.status != PulseTaskStatus.complete,
                    PulseProjectTask.due_date.isnot(None),
                    PulseProjectTask.due_date < today,
                    PulseProject.status.in_(active_statuses),
                )
            )
        ).scalar_one()
        or 0
    )

    # Roadmap behind: active/in_progress with end_date < today and progress < 100
    behind_rows = list(
        (
            await db.execute(
                select(RoadmapProject)
                .where(
                    RoadmapProject.company_id == company_id,
                    RoadmapProject.archived.is_(False),
                    RoadmapProject.end_date < today,
                    RoadmapProject.progress < 100,
                    RoadmapProject.status.notin_(["completed", "cancelled"]),
                )
                .order_by(RoadmapProject.end_date.asc())
                .limit(8)
            )
        )
        .scalars()
        .all()
    )

    items: list[dict[str, Any]] = []
    for task, project_name in overdue_tasks[:6]:
        items.append(
            _item(
                kind="project",
                title=task.title,
                priority="critical" if str(getattr(task.priority, "value", task.priority)) == "critical" else "high",
                href=f"/projects/{task.project_id}",
                detail=f"Overdue task · {project_name} · due {task.due_date.isoformat()}",
            )
        )
    for rp in behind_rows[:4]:
        items.append(
            _item(
                kind="roadmap",
                title=rp.title,
                priority="high",
                href="/roadmap",
                detail=f"Roadmap behind · ended {rp.end_date.isoformat()} · {rp.progress}%",
            )
        )

    return {
        "available": True,
        "active_count": active_n,
        "overdue_tasks": overdue_n,
        "roadmap_behind": len(behind_rows),
        "items": items,
    }


async def _planning_risks_attention(db: AsyncSession, company_id: str) -> dict[str, Any]:
    """PM coord + project activity issues — not OpsTeamRisk (Phase 2)."""
    from app.models.pm_coord_models import PmCoordRisk
    from app.models.pulse_models import PulseProject, PulseProjectActivity, PulseProjectActivityType

    risks = list(
        (
            await db.execute(
                select(PmCoordRisk)
                .where(PmCoordRisk.company_id == company_id)
                .order_by(PmCoordRisk.updated_at.desc())
                .limit(20)
            )
        )
        .scalars()
        .all()
    )
    high = sum(1 for r in risks if str(r.impact).lower() in {"high", "critical"})

    issues = list(
        (
            await db.execute(
                select(PulseProjectActivity)
                .join(PulseProject, PulseProject.id == PulseProjectActivity.project_id)
                .where(
                    PulseProject.company_id == company_id,
                    PulseProjectActivity.type == PulseProjectActivityType.issue,
                )
                .order_by(PulseProjectActivity.created_at.desc())
                .limit(8)
            )
        )
        .scalars()
        .all()
    )

    items: list[dict[str, Any]] = []
    for r in risks[:5]:
        items.append(
            _item(
                kind="pm_risk",
                title=(r.risk_description or "")[:120] or "PM coordination risk",
                priority="critical" if str(r.impact).lower() in {"high", "critical"} else "medium",
                href="/dashboard/pm-workspace",
                detail=f"Impact {r.impact}",
            )
        )
    for iss in issues[:4]:
        title = iss.title or (iss.description[:120] if iss.description else "Project issue")
        items.append(
            _item(
                kind="project_issue",
                title=str(title)[:120],
                priority="high",
                href=f"/projects/{iss.project_id}",
                detail="Open project issue",
            )
        )

    risk_count = len(risks)
    if risk_count >= 20:
        risk_count = int(
            (
                await db.execute(
                    select(func.count()).select_from(PmCoordRisk).where(PmCoordRisk.company_id == company_id)
                )
            ).scalar_one()
            or 0
        )

    return {
        "available": True,
        "pm_coord_risks": risk_count,
        "high_impact_risks": high,
        "open_project_issues": len(issues),
        "items": items,
        "team_risks_note": "Team staffing risks live under Team Development (Phase 2).",
    }


async def _budget_attention(db: AsyncSession, company_id: str) -> dict[str, Any]:
    """No spend system of record — surface roadmap budgets + planning cost placeholders."""
    from app.models.roadmap_models import RoadmapProject

    with_budget = int(
        (
            await db.execute(
                select(func.count())
                .select_from(RoadmapProject)
                .where(
                    RoadmapProject.company_id == company_id,
                    RoadmapProject.archived.is_(False),
                    RoadmapProject.budget.isnot(None),
                )
            )
        ).scalar_one()
        or 0
    )
    budget_sum = (
        await db.execute(
            select(func.coalesce(func.sum(RoadmapProject.budget), 0)).where(
                RoadmapProject.company_id == company_id,
                RoadmapProject.archived.is_(False),
                RoadmapProject.budget.isnot(None),
            )
        )
    ).scalar_one()

    ideas_with_cost = 0

    items = [
        _item(
            kind="budget",
            title="Roadmap project budgets",
            priority="medium",
            href="/roadmap",
            detail=f"{with_budget} projects with budget · sum {float(budget_sum or 0):,.0f}",
        ),
        _item(
            kind="budget",
            title="Planning ideas / estimated cost",
            priority="low",
            href="/planning",
            detail=f"{ideas_with_cost} ideas with estimated cost" if ideas_with_cost else "Open Planning for costed ideas",
        ),
        _item(
            kind="budget",
            title="Purchasing & inventory spend signals",
            priority="low",
            href="/dashboard/inventory",
            detail="No dedicated budget ledger — use inventory / purchasing workflows",
        ),
    ]
    return {
        "available": True,
        "placeholder": True,
        "roadmap_with_budget": with_budget,
        "roadmap_budget_sum": float(budget_sum or 0),
        "planning_ideas_with_cost": ideas_with_cost,
        "items": items,
    }


async def _maintenance_attention(db: AsyncSession, company_id: str) -> dict[str, Any]:
    """Work requests overdue — not equipment part PM (Phase 3 assets)."""
    from app.models.pulse_models import (
        PulseWorkOrderType,
        PulseWorkRequest,
        PulseWorkRequestPriority,
        PulseWorkRequestStatus,
    )

    now = datetime.now(timezone.utc)
    open_statuses = [
        PulseWorkRequestStatus.open,
        PulseWorkRequestStatus.in_progress,
        PulseWorkRequestStatus.hold,
    ]
    overdue_rows = list(
        (
            await db.execute(
                select(PulseWorkRequest)
                .where(
                    PulseWorkRequest.company_id == company_id,
                    PulseWorkRequest.status.in_(open_statuses),
                    PulseWorkRequest.due_date.isnot(None),
                    PulseWorkRequest.due_date < now,
                )
                .order_by(PulseWorkRequest.due_date.asc())
                .limit(20)
            )
        )
        .scalars()
        .all()
    )
    overdue_n = int(
        (
            await db.execute(
                select(func.count())
                .select_from(PulseWorkRequest)
                .where(
                    PulseWorkRequest.company_id == company_id,
                    PulseWorkRequest.status.in_(open_statuses),
                    PulseWorkRequest.due_date.isnot(None),
                    PulseWorkRequest.due_date < now,
                )
            )
        ).scalar_one()
        or 0
    )
    critical = sum(
        1
        for r in overdue_rows
        if r.priority in (PulseWorkRequestPriority.critical, PulseWorkRequestPriority.high)
        or str(getattr(r.priority, "value", r.priority)) in {"critical", "high"}
    )
    preventative_open = int(
        (
            await db.execute(
                select(func.count())
                .select_from(PulseWorkRequest)
                .where(
                    PulseWorkRequest.company_id == company_id,
                    PulseWorkRequest.status.in_(open_statuses),
                    PulseWorkRequest.work_order_type == PulseWorkOrderType.preventative,
                )
            )
        ).scalar_one()
        or 0
    )

    items = [
        _item(
            kind="maintenance",
            title=r.title,
            priority="critical"
            if str(getattr(r.priority, "value", r.priority)) == "critical"
            else "high",
            href="/dashboard/maintenance",
            detail=f"WO #{r.work_order_number} overdue"
            + (f" · due {r.due_date.date().isoformat()}" if r.due_date else ""),
        )
        for r in overdue_rows[:8]
    ]
    if preventative_open and not items:
        items.append(
            _item(
                kind="maintenance",
                title=f"{preventative_open} open preventative work order(s)",
                priority="medium",
                href="/dashboard/maintenance",
                detail="Preventative hub",
            )
        )

    return {
        "available": True,
        "overdue_work_requests": overdue_n,
        "overdue_critical_or_high": critical,
        "open_preventative": preventative_open,
        "items": items,
    }


async def gather_intelligence(db: AsyncSession, company_id: str) -> dict[str, Any]:
    assets = await _safe("assets", _assets_attention(db, company_id)) or {
        "available": False,
        "equipment_pm_overdue": 0,
        "equipment_pm_due_soon": 0,
        "equipment_in_maintenance": 0,
        "items": [],
    }
    inventory = await _safe("inventory", _inventory_attention(db, company_id)) or {
        "available": False,
        "low_stock_count": 0,
        "items": [],
    }
    procedures = await _safe("procedures", _procedures_attention(db, company_id)) or {
        "available": False,
        "active_count": 0,
        "critical_count": 0,
        "items": [],
    }
    training = await _safe("training", _training_attention(db, company_id)) or {
        "available": False,
        "overdue_count": 0,
        "expired_count": 0,
        "due_soon_count": 0,
        "items": [],
    }
    compliance = await _safe("compliance", _compliance_attention(db, company_id)) or {
        "available": False,
        "missed_count": 0,
        "high_risk_count": 0,
        "compliance_rate": 100.0,
        "items": [],
    }
    emergency = await _safe("emergency", _emergency_attention(db, company_id)) or {
        "available": False,
        "facilities_with_procedures": 0,
        "emergency_contacts": 0,
        "emergency_knowledge_articles": 0,
        "readiness_gaps": [],
        "items": [],
    }
    projects = await _safe("projects", _projects_attention(db, company_id)) or {
        "available": False,
        "active_count": 0,
        "overdue_tasks": 0,
        "roadmap_behind": 0,
        "items": [],
    }
    planning_risks = await _safe("planning_risks", _planning_risks_attention(db, company_id)) or {
        "available": False,
        "pm_coord_risks": 0,
        "high_impact_risks": 0,
        "open_project_issues": 0,
        "items": [],
    }
    budget = await _safe("budget", _budget_attention(db, company_id)) or {
        "available": False,
        "placeholder": True,
        "roadmap_with_budget": 0,
        "roadmap_budget_sum": 0,
        "planning_ideas_with_cost": 0,
        "items": [],
    }
    maintenance = await _safe("maintenance", _maintenance_attention(db, company_id)) or {
        "available": False,
        "overdue_work_requests": 0,
        "overdue_critical_or_high": 0,
        "open_preventative": 0,
        "items": [],
    }

    attention_items: list[dict[str, Any]] = []
    for block in (
        assets,
        inventory,
        training,
        compliance,
        procedures,
        emergency,
        projects,
        planning_risks,
        maintenance,
        budget,
    ):
        attention_items.extend(block.get("items") or [])

    priority_rank = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    attention_items.sort(key=lambda x: priority_rank.get(str(x.get("priority")), 9))

    return {
        "assets": assets,
        "inventory": inventory,
        "procedures": procedures,
        "training": training,
        "compliance": compliance,
        "emergency": emergency,
        "projects": projects,
        "planning_risks": planning_risks,
        "budget": budget,
        "maintenance": maintenance,
        "attention_items": attention_items[:30],
        "totals": {
            "assets_needing_attention": int(assets.get("equipment_pm_overdue") or 0)
            + int(assets.get("equipment_in_maintenance") or 0),
            "inventory_low_stock": int(inventory.get("low_stock_count") or 0),
            "training_overdue": int(training.get("overdue_count") or 0)
            + int(training.get("expired_count") or 0),
            "compliance_missed": int(compliance.get("missed_count") or 0),
            "critical_procedures": int(procedures.get("critical_count") or 0),
            "emergency_readiness_gaps": len(emergency.get("readiness_gaps") or []),
            "active_projects": int(projects.get("active_count") or 0),
            "overdue_project_tasks": int(projects.get("overdue_tasks") or 0),
            "roadmap_behind": int(projects.get("roadmap_behind") or 0),
            "pm_coord_risks": int(planning_risks.get("pm_coord_risks") or 0),
            "overdue_work_requests": int(maintenance.get("overdue_work_requests") or 0),
            "roadmap_with_budget": int(budget.get("roadmap_with_budget") or 0),
        },
    }
