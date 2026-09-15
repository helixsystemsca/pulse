"""CRUD + relationship service for recreation operations foundation entities."""

from __future__ import annotations

from typing import Any, Optional, Type

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.inspection import inspect as sa_inspect

from app.models.ops_foundation_models import (
    OpsContact,
    OpsContractor,
    OpsEntityLink,
    OpsFacility,
    OpsKnowledgeArticle,
    OpsMeeting,
    OpsPerson,
    OpsQuickNote,
    OpsRegulation,
    OpsRevision,
)

ENTITY_MODELS: dict[str, Type[Any]] = {
    "knowledge": OpsKnowledgeArticle,
    "meetings": OpsMeeting,
    "people": OpsPerson,
    "contractors": OpsContractor,
    "regulations": OpsRegulation,
    "facilities": OpsFacility,
    "quick-notes": OpsQuickNote,
    "contacts": OpsContact,
}

ENTITY_TYPES = frozenset(ENTITY_MODELS.keys())

# Fields that should not be mass-assigned from client payloads.
_PROTECTED = frozenset({"id", "company_id", "created_at", "updated_at", "created_by_user_id", "revision"})


def model_for(entity_type: str) -> Type[Any]:
    if entity_type not in ENTITY_MODELS:
        raise ValueError(f"Unknown entity type: {entity_type}")
    return ENTITY_MODELS[entity_type]


def _row_to_dict(row: Any) -> dict[str, Any]:
    mapper = sa_inspect(row.__class__)
    out: dict[str, Any] = {}
    for col in mapper.columns:
        out[col.key] = getattr(row, col.key)
    return out


async def list_links_for(
    db: AsyncSession,
    company_id: str,
    entity_type: str,
    entity_id: str,
) -> list[OpsEntityLink]:
    stmt = select(OpsEntityLink).where(
        OpsEntityLink.company_id == company_id,
        or_(
            (OpsEntityLink.from_type == entity_type) & (OpsEntityLink.from_id == entity_id),
            (OpsEntityLink.to_type == entity_type) & (OpsEntityLink.to_id == entity_id),
        ),
    )
    return list((await db.execute(stmt)).scalars().all())


async def list_records(
    db: AsyncSession,
    company_id: str,
    entity_type: str,
    *,
    q: Optional[str] = None,
    status: Optional[str] = None,
    tag: Optional[str] = None,
    category: Optional[str] = None,
) -> list[Any]:
    Model = model_for(entity_type)
    stmt = select(Model).where(Model.company_id == company_id)
    if status:
        stmt = stmt.where(Model.status == status)
    if category and hasattr(Model, "topic_category"):
        stmt = stmt.where(Model.topic_category == category.strip())
    if q and q.strip():
        like = f"%{q.strip()}%"
        clauses = [Model.title.ilike(like)]
        if hasattr(Model, "description"):
            clauses.append(Model.description.ilike(like))
        if hasattr(Model, "notes"):
            clauses.append(Model.notes.ilike(like))
        if hasattr(Model, "body_rich"):
            clauses.append(Model.body_rich.ilike(like))
        if hasattr(Model, "category"):
            clauses.append(Model.category.ilike(like))
        if hasattr(Model, "authority"):
            clauses.append(Model.authority.ilike(like))
        if hasattr(Model, "summary"):
            clauses.append(Model.summary.ilike(like))
        if hasattr(Model, "topic_category"):
            clauses.append(Model.topic_category.ilike(like))
        if hasattr(Model, "classification"):
            clauses.append(Model.classification.ilike(like))
        if hasattr(Model, "official_source_name"):
            clauses.append(Model.official_source_name.ilike(like))
        if hasattr(Model, "applicability"):
            clauses.append(Model.applicability.ilike(like))
        if hasattr(Model, "regulation_name"):
            clauses.append(Model.regulation_name.ilike(like))
        if hasattr(Model, "trade"):
            clauses.append(Model.trade.ilike(like))
        if hasattr(Model, "organization"):
            clauses.append(Model.organization.ilike(like))
        stmt = stmt.where(or_(*clauses))
    if tag:
        stmt = stmt.where(Model.tags.contains([tag]))
    stmt = stmt.order_by(Model.updated_at.desc(), Model.title)
    return list((await db.execute(stmt)).scalars().all())


async def get_record(db: AsyncSession, company_id: str, entity_type: str, record_id: str) -> Any | None:
    Model = model_for(entity_type)
    stmt = select(Model).where(Model.company_id == company_id, Model.id == record_id)
    return (await db.execute(stmt)).scalar_one_or_none()


async def create_record(
    db: AsyncSession,
    company_id: str,
    entity_type: str,
    actor_id: Optional[str],
    data: dict[str, Any],
) -> Any:
    Model = model_for(entity_type)
    payload = {k: v for k, v in data.items() if k not in _PROTECTED and hasattr(Model, k)}
    if "reports_to_person_id" in payload and payload["reports_to_person_id"] in ("", None):
        payload["reports_to_person_id"] = None
    row = Model(company_id=company_id, created_by_user_id=actor_id, **payload)
    db.add(row)
    await db.flush()
    if entity_type == "knowledge":
        await _save_revision(db, company_id, entity_type, str(row.id), actor_id, row)
    return row


async def patch_record(
    db: AsyncSession,
    company_id: str,
    entity_type: str,
    record_id: str,
    actor_id: Optional[str],
    data: dict[str, Any],
) -> Any | None:
    row = await get_record(db, company_id, entity_type, record_id)
    if not row:
        return None
    if "reports_to_person_id" in data and data["reports_to_person_id"] in ("", None):
        data = {**data, "reports_to_person_id": None}
    Model = model_for(entity_type)
    for k, v in data.items():
        if k in _PROTECTED:
            continue
        if hasattr(row, k):
            setattr(row, k, v)
    if entity_type == "knowledge" and hasattr(row, "revision"):
        row.revision = int(row.revision or 1) + 1
        await _save_revision(db, company_id, entity_type, record_id, actor_id, row)
    await db.flush()
    return row


async def delete_record(db: AsyncSession, company_id: str, entity_type: str, record_id: str) -> bool:
    row = await get_record(db, company_id, entity_type, record_id)
    if not row:
        return False
    # Remove links involving this entity
    links = await list_links_for(db, company_id, entity_type, record_id)
    for link in links:
        await db.delete(link)
    await db.delete(row)
    await db.flush()
    return True


async def create_link(
    db: AsyncSession,
    company_id: str,
    from_type: str,
    from_id: str,
    to_type: str,
    to_id: str,
    link_role: str = "related",
) -> OpsEntityLink:
    if from_type not in ENTITY_TYPES or to_type not in ENTITY_TYPES:
        raise ValueError("Invalid entity type for link")
    if not await get_record(db, company_id, from_type, from_id):
        raise ValueError("Source record not found")
    if not await get_record(db, company_id, to_type, to_id):
        raise ValueError("Target record not found")
    link = OpsEntityLink(
        company_id=company_id,
        from_type=from_type,
        from_id=from_id,
        to_type=to_type,
        to_id=to_id,
        link_role=link_role or "related",
    )
    db.add(link)
    await db.flush()
    return link


async def delete_link(db: AsyncSession, company_id: str, link_id: str) -> bool:
    stmt = select(OpsEntityLink).where(OpsEntityLink.company_id == company_id, OpsEntityLink.id == link_id)
    link = (await db.execute(stmt)).scalar_one_or_none()
    if not link:
        return False
    await db.delete(link)
    await db.flush()
    return True


async def list_revisions(
    db: AsyncSession,
    company_id: str,
    entity_type: str,
    entity_id: str,
) -> list[OpsRevision]:
    stmt = (
        select(OpsRevision)
        .where(
            OpsRevision.company_id == company_id,
            OpsRevision.entity_type == entity_type,
            OpsRevision.entity_id == entity_id,
        )
        .order_by(OpsRevision.revision.desc())
    )
    return list((await db.execute(stmt)).scalars().all())


async def _save_revision(
    db: AsyncSession,
    company_id: str,
    entity_type: str,
    entity_id: str,
    actor_id: Optional[str],
    row: Any,
) -> None:
    rev = int(getattr(row, "revision", 1) or 1)
    db.add(
        OpsRevision(
            company_id=company_id,
            entity_type=entity_type,
            entity_id=entity_id,
            revision=rev,
            snapshot=_row_to_dict(row),
            changed_by_user_id=actor_id,
        )
    )
    await db.flush()


def serialize_record(row: Any, links: Optional[list[OpsEntityLink]] = None) -> dict[str, Any]:
    data = _row_to_dict(row)
    data["links"] = [
        {
            "id": str(l.id),
            "from_type": l.from_type,
            "from_id": str(l.from_id),
            "to_type": l.to_type,
            "to_id": str(l.to_id),
            "link_role": l.link_role,
            "created_at": l.created_at,
        }
        for l in (links or [])
    ]
    if isinstance(row, OpsContractor):
        from app.services.contractor_compliance import contractor_compliance

        data["compliance"] = contractor_compliance(row)
    return data
    data = _row_to_dict(row)
    data["links"] = [
        {
            "id": str(l.id),
            "from_type": l.from_type,
            "from_id": str(l.from_id),
            "to_type": l.to_type,
            "to_id": str(l.to_id),
            "link_role": l.link_role,
            "created_at": l.created_at,
        }
        for l in (links or [])
    ]
    return data
