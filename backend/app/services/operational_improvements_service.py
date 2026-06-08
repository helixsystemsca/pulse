"""Operational improvements CRUD, workflow, and knowledge base."""

from __future__ import annotations

from datetime import date, datetime, timezone
from collections import Counter
from typing import Any, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.operational_improvement_models import (
    OperationalImprovement,
    OperationalImprovementAction,
    OperationalImprovementAnalysis,
    OperationalImprovementAttachment,
    OperationalImprovementPlaybook,
)
from app.services.operational_improvements_analytics import (
    extract_root_cause_labels,
    extract_waste_category_counts,
    parse_savings,
    prioritization_from_framework,
    prioritization_quadrant,
    top_counter_entries,
)


def format_display_id(number: int | None) -> str | None:
    if number is None or number < 1:
        return None
    return f"OI#{number:04d}"


async def allocate_display_number(db: AsyncSession, company_id: str) -> int:
    r = await db.execute(
        select(func.coalesce(func.max(OperationalImprovement.display_number), 0)).where(
            OperationalImprovement.company_id == company_id
        )
    )
    return int(r.scalar_one()) + 1


def _analysis_dict(row: OperationalImprovementAnalysis) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "company_id": str(row.company_id),
        "improvement_id": str(row.improvement_id),
        "analysis_type": row.analysis_type,
        "title": row.title,
        "data": row.data or {},
        "created_by_user_id": str(row.created_by_user_id) if row.created_by_user_id else None,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def _action_dict(row: OperationalImprovementAction) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "company_id": str(row.company_id),
        "improvement_id": str(row.improvement_id),
        "action": row.action,
        "owner_user_id": str(row.owner_user_id) if row.owner_user_id else None,
        "due_date": row.due_date,
        "status": row.status,
        "notes": row.notes,
        "linked_work_request_id": str(row.linked_work_request_id) if row.linked_work_request_id else None,
        "linked_project_id": str(row.linked_project_id) if row.linked_project_id else None,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def _attachment_dict(row: OperationalImprovementAttachment) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "company_id": str(row.company_id),
        "improvement_id": str(row.improvement_id),
        "file_name": row.file_name,
        "file_url": row.file_url,
        "attachment_type": row.attachment_type,
        "caption": row.caption,
        "uploaded_by_user_id": str(row.uploaded_by_user_id) if row.uploaded_by_user_id else None,
        "created_at": row.created_at,
    }


def _improvement_dict(row: OperationalImprovement, *, include_children: bool = True) -> dict[str, Any]:
    out: dict[str, Any] = {
        "id": str(row.id),
        "company_id": str(row.company_id),
        "display_number": row.display_number,
        "display_id": format_display_id(row.display_number),
        "title": row.title,
        "description": row.description,
        "department_slug": row.department_slug,
        "location": row.location,
        "zone_id": str(row.zone_id) if row.zone_id else None,
        "reporter_user_id": str(row.reporter_user_id) if row.reporter_user_id else None,
        "date_identified": row.date_identified,
        "priority": row.priority,
        "category": row.category,
        "estimated_impact": row.estimated_impact,
        "current_symptoms": row.current_symptoms,
        "stakeholders_affected": row.stakeholders_affected,
        "status": row.status,
        "implementation_data": row.implementation_data or {},
        "measurement_data": row.measurement_data or {},
        "framework_data": row.framework_data or {},
        "knowledge_base_published": bool(row.knowledge_base_published),
        "created_by_user_id": str(row.created_by_user_id) if row.created_by_user_id else None,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }
    if include_children:
        out["analyses"] = [_analysis_dict(a) for a in row.analyses]
        out["actions"] = [_action_dict(a) for a in row.actions]
        out["attachments"] = [_attachment_dict(a) for a in row.attachments]
    return out


def _list_dict(row: OperationalImprovement) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "company_id": str(row.company_id),
        "display_id": format_display_id(row.display_number),
        "title": row.title,
        "description": row.description,
        "department_slug": row.department_slug,
        "location": row.location,
        "priority": row.priority,
        "category": row.category,
        "estimated_impact": row.estimated_impact,
        "status": row.status,
        "date_identified": row.date_identified,
        "knowledge_base_published": bool(row.knowledge_base_published),
        "created_at": row.created_at,
        "updated_at": row.updated_at,
        "action_count": len(row.actions),
        "analysis_count": len(row.analyses),
        "prioritization_quadrant": prioritization_from_framework(row.framework_data),
        "template_id": (row.framework_data or {}).get("template_id"),
    }


OPEN_STATUSES = frozenset({"identified", "analyzing", "planning", "implementing", "measuring"})


async def list_improvements(
    db: AsyncSession,
    company_id: str,
    *,
    status: Optional[str] = None,
    category: Optional[str] = None,
    q: Optional[str] = None,
) -> list[OperationalImprovement]:
    stmt = (
        select(OperationalImprovement)
        .where(OperationalImprovement.company_id == company_id)
        .options(
            selectinload(OperationalImprovement.analyses),
            selectinload(OperationalImprovement.actions),
        )
    )
    if status:
        stmt = stmt.where(OperationalImprovement.status == status.strip())
    if category:
        stmt = stmt.where(OperationalImprovement.category == category.strip())
    if q and q.strip():
        needle = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            OperationalImprovement.title.ilike(needle)
            | OperationalImprovement.description.ilike(needle)
            | OperationalImprovement.location.ilike(needle)
            | OperationalImprovement.estimated_impact.ilike(needle)
        )
    stmt = stmt.order_by(OperationalImprovement.updated_at.desc())
    return list((await db.execute(stmt)).scalars().unique().all())


async def get_improvement(
    db: AsyncSession,
    company_id: str,
    improvement_id: str,
    *,
    load_children: bool = True,
) -> OperationalImprovement | None:
    stmt = select(OperationalImprovement).where(
        OperationalImprovement.id == improvement_id,
        OperationalImprovement.company_id == company_id,
    )
    if load_children:
        stmt = stmt.options(
            selectinload(OperationalImprovement.analyses),
            selectinload(OperationalImprovement.actions),
            selectinload(OperationalImprovement.attachments),
        )
    row = (await db.execute(stmt)).scalar_one_or_none()
    return row


async def create_improvement(
    db: AsyncSession,
    company_id: str,
    actor_id: str,
    *,
    title: str,
    description: Optional[str],
    department_slug: Optional[str],
    location: Optional[str],
    zone_id: Optional[str],
    reporter_user_id: Optional[str],
    date_identified: Optional[date],
    priority: str,
    category: str,
    estimated_impact: Optional[str],
    current_symptoms: Optional[str],
    stakeholders_affected: Optional[str],
    status: str,
    framework_data: Optional[dict[str, Any]] = None,
) -> OperationalImprovement:
    fw = dict(framework_data or {})
    pri = fw.get("prioritization") or {}
    if isinstance(pri, dict) and pri.get("impact") and pri.get("effort") and not pri.get("quadrant"):
        pri["quadrant"] = prioritization_quadrant(int(pri["impact"]), int(pri["effort"]))
        fw["prioritization"] = pri
    row = OperationalImprovement(
        company_id=company_id,
        display_number=await allocate_display_number(db, company_id),
        title=title.strip(),
        description=(description or "").strip() or None,
        department_slug=(department_slug or "").strip() or None,
        location=(location or "").strip() or None,
        zone_id=zone_id or None,
        reporter_user_id=reporter_user_id or actor_id,
        date_identified=date_identified or date.today(),
        priority=priority,
        category=category,
        estimated_impact=(estimated_impact or "").strip() or None,
        current_symptoms=(current_symptoms or "").strip() or None,
        stakeholders_affected=(stakeholders_affected or "").strip() or None,
        status=status,
        framework_data=fw,
        created_by_user_id=actor_id,
    )
    db.add(row)
    await db.flush()
    return row


async def patch_improvement(
    db: AsyncSession,
    row: OperationalImprovement,
    **fields: Any,
) -> OperationalImprovement:
    for key, value in fields.items():
        if value is None and key not in ("implementation_data", "measurement_data", "framework_data"):
            continue
        if key == "framework_data" and isinstance(value, dict):
            pri = value.get("prioritization") or {}
            if isinstance(pri, dict) and pri.get("impact") and pri.get("effort"):
                pri["quadrant"] = prioritization_quadrant(int(pri["impact"]), int(pri["effort"]))
                value = {**value, "prioritization": pri}
        if key in ("title", "description", "department_slug", "location", "estimated_impact", "current_symptoms", "stakeholders_affected"):
            if isinstance(value, str):
                value = value.strip() or None
        setattr(row, key, value)
    row.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return row


async def delete_improvement(db: AsyncSession, row: OperationalImprovement) -> None:
    await db.delete(row)


async def compute_stats(db: AsyncSession, company_id: str) -> dict[str, Any]:
    stmt = (
        select(OperationalImprovement)
        .where(OperationalImprovement.company_id == company_id)
        .options(selectinload(OperationalImprovement.analyses))
    )
    improvements = list((await db.execute(stmt)).scalars().unique().all())

    by_status: dict[str, int] = {}
    by_category: dict[str, int] = {}
    by_prioritization_quadrant: dict[str, int] = {}
    open_by_department: dict[str, int] = {}
    open_count = 0
    completed_count = 0
    awaiting_review_count = 0
    high_impact_open = 0
    quick_wins_completed = 0
    knowledge_base_count = 0
    savings_total = 0.0
    root_cause_counter: Counter[str] = Counter()
    waste_counter: Counter[str] = Counter()

    for row in improvements:
        status = row.status
        category = row.category
        by_status[status] = by_status.get(status, 0) + 1
        by_category[category] = by_category.get(category, 0) + 1
        if row.knowledge_base_published:
            knowledge_base_count += 1
        measurement = row.measurement_data or {}
        savings_total += parse_savings(measurement.get("estimated_savings"))
        for m in measurement.get("scorecard_metrics") or []:
            if isinstance(m, dict):
                savings_total += parse_savings(m.get("savings"))

        quadrant = prioritization_from_framework(row.framework_data) or "unscored"
        by_prioritization_quadrant[quadrant] = by_prioritization_quadrant.get(quadrant, 0) + 1

        if status in OPEN_STATUSES:
            open_count += 1
            if row.estimated_impact and row.estimated_impact.strip():
                high_impact_open += 1
            dept = (row.department_slug or "Unassigned").strip() or "Unassigned"
            open_by_department[dept] = open_by_department.get(dept, 0) + 1
        elif status == "completed":
            completed_count += 1
            if quadrant == "quick_win":
                quick_wins_completed += 1
        elif status == "awaiting_review":
            awaiting_review_count += 1

        for label in extract_root_cause_labels(row.analyses):
            root_cause_counter[label[:120]] += 1
        waste_counter.update(extract_waste_category_counts(row.analyses))

    total = len(improvements)
    completion_rate = round(completed_count / total, 3) if total else 0.0

    return {
        "open_count": open_count,
        "completed_count": completed_count,
        "awaiting_review_count": awaiting_review_count,
        "by_status": by_status,
        "by_category": by_category,
        "high_impact_open": high_impact_open,
        "completion_rate": completion_rate,
        "total_count": total,
        "quick_wins_completed": quick_wins_completed,
        "knowledge_base_count": knowledge_base_count,
        "estimated_savings_total": round(savings_total, 2),
        "open_by_department": open_by_department,
        "by_prioritization_quadrant": by_prioritization_quadrant,
        "top_root_causes": top_counter_entries(root_cause_counter),
        "top_waste_categories": top_counter_entries(waste_counter),
    }


async def list_case_studies(
    db: AsyncSession,
    company_id: str,
    *,
    q: Optional[str] = None,
) -> list[dict[str, Any]]:
    stmt = (
        select(OperationalImprovement)
        .where(
            OperationalImprovement.company_id == company_id,
            OperationalImprovement.knowledge_base_published.is_(True),
        )
        .options(
            selectinload(OperationalImprovement.analyses),
            selectinload(OperationalImprovement.actions),
        )
        .order_by(OperationalImprovement.updated_at.desc())
    )
    if q and q.strip():
        needle = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            OperationalImprovement.title.ilike(needle)
            | OperationalImprovement.description.ilike(needle)
            | OperationalImprovement.estimated_impact.ilike(needle)
        )
    rows = list((await db.execute(stmt)).scalars().unique().all())
    out: list[dict[str, Any]] = []
    for row in rows:
        measurement = row.measurement_data or {}
        impl = row.implementation_data or {}
        root_cause_parts: list[str] = []
        for analysis in row.analyses:
            if analysis.analysis_type in ("root_cause_5_whys", "fishbone"):
                data = analysis.data or {}
                if analysis.analysis_type == "root_cause_5_whys":
                    whys = data.get("whys") or []
                    root_cause_parts.extend(str(w).strip() for w in whys if str(w).strip())
                elif analysis.analysis_type == "fishbone":
                    factors = data.get("contributing_factors") or []
                    root_cause_parts.extend(str(f).strip() for f in factors if str(f).strip())
        solution_parts = [a.action for a in row.actions if a.action.strip()]
        out.append(
            {
                "id": str(row.id),
                "display_id": format_display_id(row.display_number),
                "title": row.title,
                "category": row.category,
                "department_slug": row.department_slug,
                "location": row.location,
                "problem": row.current_symptoms or row.description,
                "root_cause": "\n".join(root_cause_parts) or None,
                "solution": "\n".join(solution_parts) or measurement.get("success_criteria"),
                "results": measurement.get("actual_results"),
                "lessons_learned": measurement.get("lessons_learned"),
                "completed_at": impl.get("completion_date"),
                "published_at": row.updated_at,
            }
        )
    return out


async def create_analysis(
    db: AsyncSession,
    row: OperationalImprovement,
    actor_id: str,
    *,
    analysis_type: str,
    title: Optional[str],
    data: dict[str, Any],
) -> OperationalImprovementAnalysis:
    analysis = OperationalImprovementAnalysis(
        company_id=row.company_id,
        improvement_id=row.id,
        analysis_type=analysis_type,
        title=(title or "").strip() or None,
        data=data or {},
        created_by_user_id=actor_id,
    )
    db.add(analysis)
    row.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return analysis


async def patch_analysis(
    db: AsyncSession,
    analysis: OperationalImprovementAnalysis,
    *,
    title: Optional[str] = None,
    data: Optional[dict[str, Any]] = None,
) -> OperationalImprovementAnalysis:
    if title is not None:
        analysis.title = title.strip() or None
    if data is not None:
        analysis.data = data
    analysis.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return analysis


async def delete_analysis(db: AsyncSession, analysis: OperationalImprovementAnalysis) -> None:
    await db.delete(analysis)


async def get_analysis(
    db: AsyncSession,
    company_id: str,
    analysis_id: str,
) -> OperationalImprovementAnalysis | None:
    row = await db.get(OperationalImprovementAnalysis, analysis_id)
    if not row or str(row.company_id) != company_id:
        return None
    return row


async def create_action(
    db: AsyncSession,
    row: OperationalImprovement,
    *,
    action: str,
    owner_user_id: Optional[str],
    due_date: Optional[date],
    status: str,
    notes: Optional[str],
    linked_work_request_id: Optional[str],
    linked_project_id: Optional[str],
) -> OperationalImprovementAction:
    item = OperationalImprovementAction(
        company_id=row.company_id,
        improvement_id=row.id,
        action=action.strip(),
        owner_user_id=owner_user_id,
        due_date=due_date,
        status=status,
        notes=(notes or "").strip() or None,
        linked_work_request_id=linked_work_request_id,
        linked_project_id=linked_project_id,
    )
    db.add(item)
    row.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return item


async def patch_action(
    db: AsyncSession,
    item: OperationalImprovementAction,
    **fields: Any,
) -> OperationalImprovementAction:
    for key, value in fields.items():
        if value is None and key not in ("notes", "due_date", "owner_user_id"):
            continue
        if key == "action" and isinstance(value, str):
            value = value.strip()
        if key == "notes" and isinstance(value, str):
            value = value.strip() or None
        setattr(item, key, value)
    item.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return item


async def delete_action(db: AsyncSession, item: OperationalImprovementAction) -> None:
    await db.delete(item)


async def get_action(
    db: AsyncSession,
    company_id: str,
    action_id: str,
) -> OperationalImprovementAction | None:
    row = await db.get(OperationalImprovementAction, action_id)
    if not row or str(row.company_id) != company_id:
        return None
    return row


async def create_attachment(
    db: AsyncSession,
    row: OperationalImprovement,
    actor_id: str,
    *,
    file_name: str,
    file_url: Optional[str],
    attachment_type: str,
    caption: Optional[str],
) -> OperationalImprovementAttachment:
    att = OperationalImprovementAttachment(
        company_id=row.company_id,
        improvement_id=row.id,
        file_name=file_name.strip(),
        file_url=(file_url or "").strip() or None,
        attachment_type=attachment_type,
        caption=(caption or "").strip() or None,
        uploaded_by_user_id=actor_id,
    )
    db.add(att)
    row.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return att


async def delete_attachment(db: AsyncSession, att: OperationalImprovementAttachment) -> None:
    await db.delete(att)


async def get_attachment(
    db: AsyncSession,
    company_id: str,
    attachment_id: str,
) -> OperationalImprovementAttachment | None:
    row = await db.get(OperationalImprovementAttachment, attachment_id)
    if not row or str(row.company_id) != company_id:
        return None
    return row


def _playbook_dict(row: OperationalImprovementPlaybook) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "company_id": str(row.company_id),
        "source_improvement_id": str(row.source_improvement_id) if row.source_improvement_id else None,
        "title": row.title,
        "category": row.category,
        "template_id": row.template_id,
        "problem": row.problem,
        "root_cause": row.root_cause,
        "solution": row.solution,
        "results": row.results,
        "lessons_learned": row.lessons_learned,
        "created_by_user_id": str(row.created_by_user_id) if row.created_by_user_id else None,
        "created_at": row.created_at,
    }


async def list_playbooks(
    db: AsyncSession,
    company_id: str,
    *,
    q: Optional[str] = None,
) -> list[OperationalImprovementPlaybook]:
    stmt = select(OperationalImprovementPlaybook).where(OperationalImprovementPlaybook.company_id == company_id)
    if q and q.strip():
        needle = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            OperationalImprovementPlaybook.title.ilike(needle)
            | OperationalImprovementPlaybook.problem.ilike(needle)
            | OperationalImprovementPlaybook.root_cause.ilike(needle)
        )
    stmt = stmt.order_by(OperationalImprovementPlaybook.created_at.desc())
    return list((await db.execute(stmt)).scalars().all())


async def get_playbook(db: AsyncSession, company_id: str, playbook_id: str) -> OperationalImprovementPlaybook | None:
    row = await db.get(OperationalImprovementPlaybook, playbook_id)
    if not row or str(row.company_id) != company_id:
        return None
    return row


def _playbook_payload_from_improvement(row: OperationalImprovement) -> dict[str, str | None]:
    measurement = row.measurement_data or {}
    root_labels = extract_root_cause_labels(row.analyses)
    solution_parts = [a.action for a in row.actions if a.action.strip()]
    return {
        "problem": row.current_symptoms or row.description,
        "root_cause": root_labels[-1] if root_labels else None,
        "solution": "\n".join(solution_parts) or measurement.get("success_criteria"),
        "results": measurement.get("actual_results"),
        "lessons_learned": measurement.get("lessons_learned"),
    }


async def create_playbook_from_improvement(
    db: AsyncSession,
    company_id: str,
    actor_id: str,
    improvement_id: str,
    *,
    title: Optional[str] = None,
) -> OperationalImprovementPlaybook:
    row = await get_improvement(db, company_id, improvement_id)
    if not row:
        raise ValueError("Improvement not found")
    payload = _playbook_payload_from_improvement(row)
    fw = row.framework_data or {}
    playbook = OperationalImprovementPlaybook(
        company_id=company_id,
        source_improvement_id=row.id,
        title=(title or row.title).strip(),
        category=row.category,
        template_id=fw.get("template_id"),
        problem=payload["problem"],
        root_cause=payload["root_cause"],
        solution=payload["solution"],
        results=payload["results"],
        lessons_learned=payload["lessons_learned"],
        created_by_user_id=actor_id,
    )
    db.add(playbook)
    await db.flush()
    return playbook
