"""Recreation operations foundation API — CRUD + relationships for ops entities."""

from __future__ import annotations

from typing import Annotated, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_any_rbac, require_tenant_user
from app.models.domain import User
from app.schemas.ops_foundation import (
    OpsContactCreateIn,
    OpsContactOut,
    OpsContactPatchIn,
    OpsContractorCreateIn,
    OpsContractorOut,
    OpsContractorPatchIn,
    OpsFacilityCreateIn,
    OpsFacilityOut,
    OpsFacilityPatchIn,
    OpsKnowledgeCreateIn,
    OpsKnowledgeOut,
    OpsKnowledgePatchIn,
    OpsLinkCreateIn,
    OpsLinkOut,
    OpsMeetingCreateIn,
    OpsMeetingOut,
    OpsMeetingPatchIn,
    OpsPersonCreateIn,
    OpsPersonOut,
    OpsPersonPatchIn,
    OpsQuickNoteCreateIn,
    OpsQuickNoteOut,
    OpsQuickNotePatchIn,
    OpsRegulationCreateIn,
    OpsRegulationOut,
    OpsRegulationPatchIn,
    OpsRevisionOut,
)
from app.services import ops_foundation_service as svc

router = APIRouter(prefix="/recreation-ops", tags=["recreation-ops"])

Db = Annotated[AsyncSession, Depends(get_db)]
CompanyId = Annotated[str, Depends(lambda u=Depends(require_tenant_user): str(u.company_id))]
Actor = Annotated[User, Depends(require_tenant_user)]
Reader = Annotated[User, Depends(require_any_rbac("recreation_ops.view", "recreation_ops.manage"))]
Editor = Annotated[User, Depends(require_any_rbac("recreation_ops.manage"))]

OUT_MODELS = {
    "knowledge": OpsKnowledgeOut,
    "meetings": OpsMeetingOut,
    "people": OpsPersonOut,
    "contractors": OpsContractorOut,
    "regulations": OpsRegulationOut,
    "facilities": OpsFacilityOut,
    "quick-notes": OpsQuickNoteOut,
    "contacts": OpsContactOut,
}

CREATE_MODELS = {
    "knowledge": OpsKnowledgeCreateIn,
    "meetings": OpsMeetingCreateIn,
    "people": OpsPersonCreateIn,
    "contractors": OpsContractorCreateIn,
    "regulations": OpsRegulationCreateIn,
    "facilities": OpsFacilityCreateIn,
    "quick-notes": OpsQuickNoteCreateIn,
    "contacts": OpsContactCreateIn,
}

PATCH_MODELS = {
    "knowledge": OpsKnowledgePatchIn,
    "meetings": OpsMeetingPatchIn,
    "people": OpsPersonPatchIn,
    "contractors": OpsContractorPatchIn,
    "regulations": OpsRegulationPatchIn,
    "facilities": OpsFacilityPatchIn,
    "quick-notes": OpsQuickNotePatchIn,
    "contacts": OpsContactPatchIn,
}


def _ensure_type(entity_type: str) -> str:
    if entity_type not in svc.ENTITY_TYPES:
        raise HTTPException(status_code=404, detail=f"Unknown module '{entity_type}'")
    return entity_type


async def _out(db: AsyncSession, cid: str, entity_type: str, row: Any) -> Any:
    links = await svc.list_links_for(db, cid, entity_type, str(row.id))
    data = svc.serialize_record(row, links)
    return OUT_MODELS[entity_type].model_validate(data)


@router.get("/{entity_type}", response_model=list[dict[str, Any]])
async def list_entities(
    entity_type: str,
    db: Db,
    cid: CompanyId,
    _: Reader,
    q: Optional[str] = Query(None, max_length=200),
    status_filter: Optional[str] = Query(None, alias="status", max_length=64),
    tag: Optional[str] = Query(None, max_length=64),
) -> list[dict[str, Any]]:
    et = _ensure_type(entity_type)
    rows = await svc.list_records(db, cid, et, q=q, status=status_filter, tag=tag)
    out = []
    for row in rows:
        links = await svc.list_links_for(db, cid, et, str(row.id))
        out.append(OUT_MODELS[et].model_validate(svc.serialize_record(row, links)).model_dump(mode="json"))
    return out


@router.post("/{entity_type}", status_code=status.HTTP_201_CREATED)
async def create_entity(
    entity_type: str,
    db: Db,
    cid: CompanyId,
    actor: Editor,
    body: dict[str, Any],
) -> dict[str, Any]:
    et = _ensure_type(entity_type)
    parsed = CREATE_MODELS[et].model_validate(body)
    row = await svc.create_record(db, cid, et, str(actor.id), parsed.model_dump())
    await db.commit()
    row = await svc.get_record(db, cid, et, str(row.id))
    return (await _out(db, cid, et, row)).model_dump(mode="json")


@router.get("/{entity_type}/{record_id}")
async def get_entity(
    entity_type: str,
    record_id: str,
    db: Db,
    cid: CompanyId,
    _: Reader,
) -> dict[str, Any]:
    et = _ensure_type(entity_type)
    row = await svc.get_record(db, cid, et, record_id)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    return (await _out(db, cid, et, row)).model_dump(mode="json")


@router.patch("/{entity_type}/{record_id}")
async def patch_entity(
    entity_type: str,
    record_id: str,
    db: Db,
    cid: CompanyId,
    actor: Editor,
    body: dict[str, Any],
) -> dict[str, Any]:
    et = _ensure_type(entity_type)
    parsed = PATCH_MODELS[et].model_validate(body)
    row = await svc.patch_record(
        db, cid, et, record_id, str(actor.id), parsed.model_dump(exclude_unset=True)
    )
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    await db.commit()
    row = await svc.get_record(db, cid, et, record_id)
    return (await _out(db, cid, et, row)).model_dump(mode="json")


@router.delete("/{entity_type}/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entity(
    entity_type: str,
    record_id: str,
    db: Db,
    cid: CompanyId,
    _: Editor,
) -> None:
    et = _ensure_type(entity_type)
    ok = await svc.delete_record(db, cid, et, record_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Not found")
    await db.commit()


@router.post("/{entity_type}/{record_id}/links", status_code=status.HTTP_201_CREATED, response_model=OpsLinkOut)
async def add_link(
    entity_type: str,
    record_id: str,
    db: Db,
    cid: CompanyId,
    _: Editor,
    body: OpsLinkCreateIn,
) -> OpsLinkOut:
    et = _ensure_type(entity_type)
    try:
        link = await svc.create_link(
            db, cid, et, record_id, body.to_type, body.to_id, body.link_role
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    await db.commit()
    return OpsLinkOut.model_validate(link)


@router.delete("/{entity_type}/{record_id}/links/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_link(
    entity_type: str,
    record_id: str,
    link_id: str,
    db: Db,
    cid: CompanyId,
    _: Editor,
) -> None:
    _ensure_type(entity_type)
    ok = await svc.delete_link(db, cid, link_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Link not found")
    await db.commit()


@router.get("/{entity_type}/{record_id}/revisions", response_model=list[OpsRevisionOut])
async def list_entity_revisions(
    entity_type: str,
    record_id: str,
    db: Db,
    cid: CompanyId,
    _: Reader,
) -> list[OpsRevisionOut]:
    et = _ensure_type(entity_type)
    rows = await svc.list_revisions(db, cid, et, record_id)
    return [OpsRevisionOut.model_validate(r) for r in rows]
