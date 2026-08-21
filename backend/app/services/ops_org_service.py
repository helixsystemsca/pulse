"""Phase 2 organization — org chart, skills matrix, development plans, team risks."""

from __future__ import annotations

from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ops_command_models import OpsDevelopmentPlan, OpsSkill, OpsSkillRating, OpsTeamRisk
from app.models.ops_foundation_models import OpsPerson


async def org_chart(db: AsyncSession, company_id: str) -> list[dict[str, Any]]:
    rows = list(
        (
            await db.execute(
                select(OpsPerson)
                .where(OpsPerson.company_id == company_id, OpsPerson.status != "archived")
                .order_by(OpsPerson.sort_order, OpsPerson.title)
            )
        )
        .scalars()
        .all()
    )
    by_id: dict[str, dict[str, Any]] = {}
    for r in rows:
        by_id[str(r.id)] = {
            "id": str(r.id),
            "title": r.title,
            "position": r.position,
            "department": r.department,
            "team_name": r.team_name,
            "role_label": r.role_label,
            "reports_to_person_id": str(r.reports_to_person_id) if r.reports_to_person_id else None,
            "status": r.status,
            "children": [],
        }
    roots: list[dict[str, Any]] = []
    for node in by_id.values():
        parent = node["reports_to_person_id"]
        if parent and parent in by_id and parent != node["id"]:
            by_id[parent]["children"].append(node)
        else:
            roots.append(node)
    return roots


async def list_skills(db: AsyncSession, company_id: str) -> list[OpsSkill]:
    stmt = select(OpsSkill).where(OpsSkill.company_id == company_id).order_by(OpsSkill.sort_order, OpsSkill.name)
    return list((await db.execute(stmt)).scalars().all())


async def create_skill(db: AsyncSession, company_id: str, data: dict[str, Any]) -> OpsSkill:
    row = OpsSkill(company_id=company_id, **data)
    db.add(row)
    await db.flush()
    return row


async def patch_skill(db: AsyncSession, company_id: str, skill_id: str, data: dict[str, Any]) -> OpsSkill | None:
    row = (
        await db.execute(select(OpsSkill).where(OpsSkill.company_id == company_id, OpsSkill.id == skill_id))
    ).scalar_one_or_none()
    if not row:
        return None
    for k, v in data.items():
        if hasattr(row, k):
            setattr(row, k, v)
    await db.flush()
    return row


async def delete_skill(db: AsyncSession, company_id: str, skill_id: str) -> bool:
    row = (
        await db.execute(select(OpsSkill).where(OpsSkill.company_id == company_id, OpsSkill.id == skill_id))
    ).scalar_one_or_none()
    if not row:
        return False
    await db.delete(row)
    await db.flush()
    return True


async def list_ratings(db: AsyncSession, company_id: str) -> list[dict[str, Any]]:
    skills = {str(s.id): s.name for s in await list_skills(db, company_id)}
    people = {
        str(p.id): p.title
        for p in (
            await db.execute(select(OpsPerson).where(OpsPerson.company_id == company_id))
        )
        .scalars()
        .all()
    }
    rows = list(
        (await db.execute(select(OpsSkillRating).where(OpsSkillRating.company_id == company_id))).scalars().all()
    )
    out = []
    for r in rows:
        out.append(
            {
                "id": str(r.id),
                "skill_id": str(r.skill_id),
                "person_id": str(r.person_id),
                "proficiency": r.proficiency,
                "certification": r.certification,
                "last_demonstrated": r.last_demonstrated,
                "training_required": r.training_required,
                "cross_training_status": r.cross_training_status,
                "notes": r.notes,
                "skill_name": skills.get(str(r.skill_id)),
                "person_name": people.get(str(r.person_id)),
            }
        )
    return out


async def upsert_rating(db: AsyncSession, company_id: str, data: dict[str, Any]) -> OpsSkillRating:
    existing = (
        await db.execute(
            select(OpsSkillRating).where(
                OpsSkillRating.company_id == company_id,
                OpsSkillRating.skill_id == data["skill_id"],
                OpsSkillRating.person_id == data["person_id"],
            )
        )
    ).scalar_one_or_none()
    if existing:
        for k, v in data.items():
            if k in {"skill_id", "person_id"}:
                continue
            if hasattr(existing, k):
                setattr(existing, k, v)
        await db.flush()
        return existing
    row = OpsSkillRating(company_id=company_id, **data)
    db.add(row)
    await db.flush()
    return row


async def delete_rating(db: AsyncSession, company_id: str, rating_id: str) -> bool:
    row = (
        await db.execute(
            select(OpsSkillRating).where(OpsSkillRating.company_id == company_id, OpsSkillRating.id == rating_id)
        )
    ).scalar_one_or_none()
    if not row:
        return False
    await db.delete(row)
    await db.flush()
    return True


async def list_plans(db: AsyncSession, company_id: str) -> list[dict[str, Any]]:
    people = {
        str(p.id): p.title
        for p in (await db.execute(select(OpsPerson).where(OpsPerson.company_id == company_id))).scalars().all()
    }
    rows = list(
        (
            await db.execute(
                select(OpsDevelopmentPlan)
                .where(OpsDevelopmentPlan.company_id == company_id)
                .order_by(OpsDevelopmentPlan.updated_at.desc())
            )
        )
        .scalars()
        .all()
    )
    return [
        {
            "id": str(r.id),
            "person_id": str(r.person_id),
            "title": r.title,
            "strengths": r.strengths,
            "development_goals": r.development_goals,
            "training": r.training,
            "mentoring": r.mentoring,
            "cross_training": r.cross_training,
            "target_date": r.target_date,
            "progress": r.progress,
            "status": r.status,
            "notes": r.notes,
            "person_name": people.get(str(r.person_id)),
        }
        for r in rows
    ]


async def create_plan(db: AsyncSession, company_id: str, data: dict[str, Any]) -> OpsDevelopmentPlan:
    row = OpsDevelopmentPlan(company_id=company_id, **data)
    db.add(row)
    await db.flush()
    return row


async def patch_plan(
    db: AsyncSession, company_id: str, plan_id: str, data: dict[str, Any]
) -> OpsDevelopmentPlan | None:
    row = (
        await db.execute(
            select(OpsDevelopmentPlan).where(
                OpsDevelopmentPlan.company_id == company_id, OpsDevelopmentPlan.id == plan_id
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


async def delete_plan(db: AsyncSession, company_id: str, plan_id: str) -> bool:
    row = (
        await db.execute(
            select(OpsDevelopmentPlan).where(
                OpsDevelopmentPlan.company_id == company_id, OpsDevelopmentPlan.id == plan_id
            )
        )
    ).scalar_one_or_none()
    if not row:
        return False
    await db.delete(row)
    await db.flush()
    return True


async def list_risks(db: AsyncSession, company_id: str) -> list[dict[str, Any]]:
    people = {
        str(p.id): p.title
        for p in (await db.execute(select(OpsPerson).where(OpsPerson.company_id == company_id))).scalars().all()
    }
    rows = list(
        (
            await db.execute(
                select(OpsTeamRisk).where(OpsTeamRisk.company_id == company_id).order_by(OpsTeamRisk.updated_at.desc())
            )
        )
        .scalars()
        .all()
    )
    return [
        {
            "id": str(r.id),
            "title": r.title,
            "risk_type": r.risk_type,
            "description": r.description,
            "severity": r.severity,
            "related_person_id": str(r.related_person_id) if r.related_person_id else None,
            "related_skill": r.related_skill,
            "status": r.status,
            "mitigation": r.mitigation,
            "notes": r.notes,
            "person_name": people.get(str(r.related_person_id)) if r.related_person_id else None,
        }
        for r in rows
    ]


async def create_risk(db: AsyncSession, company_id: str, data: dict[str, Any]) -> OpsTeamRisk:
    row = OpsTeamRisk(company_id=company_id, **data)
    db.add(row)
    await db.flush()
    return row


async def patch_risk(db: AsyncSession, company_id: str, risk_id: str, data: dict[str, Any]) -> OpsTeamRisk | None:
    row = (
        await db.execute(select(OpsTeamRisk).where(OpsTeamRisk.company_id == company_id, OpsTeamRisk.id == risk_id))
    ).scalar_one_or_none()
    if not row:
        return None
    for k, v in data.items():
        if hasattr(row, k):
            setattr(row, k, v)
    await db.flush()
    return row


async def delete_risk(db: AsyncSession, company_id: str, risk_id: str) -> bool:
    row = (
        await db.execute(select(OpsTeamRisk).where(OpsTeamRisk.company_id == company_id, OpsTeamRisk.id == risk_id))
    ).scalar_one_or_none()
    if not row:
        return False
    await db.delete(row)
    await db.flush()
    return True


async def org_attention_counts(db: AsyncSession, company_id: str) -> dict[str, int]:
    people_n = len(
        (
            await db.execute(
                select(OpsPerson).where(OpsPerson.company_id == company_id, OpsPerson.status != "archived")
            )
        )
        .scalars()
        .all()
    )
    risks = await list_risks(db, company_id)
    open_risks = sum(1 for r in risks if r["status"] in {"open", "monitoring"})
    return {"people_count": people_n, "open_team_risks": open_risks}
