"""Hire-time onboarding document packets under `/api/workers`."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status

from app.api.workers_routes import (
    CompanyId,
    Db,
    RosterPageUser,
    _roster_user_in_company_any_status,
)
from app.models.pulse_models import PulseHireOnboardingItem
from app.schemas.hire_onboarding import (
    HireCompleteItemIn,
    HireIncompleteSummaryOut,
    HirePacketItemOut,
    HirePacketListOut,
    HirePacketOut,
    HirePacketProgressOut,
    HireTemplateItemOut,
    HireTemplateOut,
    HireTemplatePutIn,
)
from app.services.hire_onboarding.service import (
    complete_item,
    ensure_default_template,
    ensure_packet_for_user,
    get_packet_for_user,
    incomplete_summary,
    list_packets_with_progress,
    refresh_packet_progress,
    replace_template_items,
)

router = APIRouter(prefix="/workers", tags=["workers-hire-onboarding"])


def _progress_out(progress: dict) -> HirePacketProgressOut:
    return HirePacketProgressOut(
        required_total=int(progress["required_total"]),
        required_completed=int(progress["required_completed"]),
        percent=int(progress["percent"]),
        status=str(progress["status"]),
    )


def _packet_out(packet, user, items, progress) -> HirePacketOut:
    return HirePacketOut(
        id=packet.id,
        user_id=str(user.id),
        full_name=user.full_name,
        email=user.email,
        status=packet.status,
        progress=_progress_out(progress),
        items=[HirePacketItemOut.model_validate(i) for i in items],
        created_at=packet.created_at,
        updated_at=packet.updated_at,
        completed_at=packet.completed_at,
    )


def _template_out(row) -> HireTemplateOut:
    items = [
        HireTemplateItemOut(
            id=str(spec.get("id") or ""),
            key=str(spec.get("key") or ""),
            title=str(spec.get("title") or ""),
            description=spec.get("description"),
            kind=str(spec.get("kind") or "review"),
            body_text=spec.get("body_text"),
            applies_when=str(spec.get("applies_when") or "always"),
            is_required=bool(spec.get("is_required", True)),
        )
        for spec in (row.items or [])
        if isinstance(spec, dict) and spec.get("title")
    ]
    return HireTemplateOut(
        id=row.id,
        company_id=str(row.company_id),
        name=row.name,
        items=items,
        updated_at=row.updated_at,
    )


@router.get("/hire-onboarding/template", response_model=HireTemplateOut)
async def get_hire_onboarding_template(db: Db, _: RosterPageUser, cid: CompanyId) -> HireTemplateOut:
    row = await ensure_default_template(db, cid)
    await db.commit()
    return _template_out(row)


@router.put("/hire-onboarding/template", response_model=HireTemplateOut)
async def put_hire_onboarding_template(
    db: Db,
    _: RosterPageUser,
    cid: CompanyId,
    body: HireTemplatePutIn,
) -> HireTemplateOut:
    row = await replace_template_items(db, cid, name=body.name, items=[i.model_dump() for i in body.items])
    await db.commit()
    return _template_out(row)


@router.get("/hire-onboarding/incomplete-summary", response_model=HireIncompleteSummaryOut)
async def get_hire_onboarding_incomplete_summary(
    db: Db,
    _: RosterPageUser,
    cid: CompanyId,
) -> HireIncompleteSummaryOut:
    payload = await incomplete_summary(db, company_id=cid)
    await db.commit()
    return HireIncompleteSummaryOut(**payload)


@router.get("/hire-onboarding/packets", response_model=HirePacketListOut)
async def list_hire_onboarding_packets(
    db: Db,
    _: RosterPageUser,
    cid: CompanyId,
    packet_status: Optional[str] = Query(None, alias="status"),
) -> HirePacketListOut:
    status_filter = packet_status.strip().lower() if packet_status else None
    if status_filter and status_filter not in {"open", "completed"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="status must be open or completed")
    rows = await list_packets_with_progress(db, company_id=cid, status=status_filter)
    await db.commit()
    return HirePacketListOut(items=[_packet_out(*row) for row in rows])


@router.get("/{user_id}/hire-onboarding", response_model=HirePacketOut)
async def get_worker_hire_onboarding(
    db: Db,
    _: RosterPageUser,
    cid: CompanyId,
    user_id: str,
) -> HirePacketOut:
    user = await _roster_user_in_company_any_status(db, cid, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Worker not found")
    packet = await get_packet_for_user(db, cid, user_id)
    if not packet:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No hire onboarding packet")
    items, progress = await refresh_packet_progress(db, packet)
    await db.commit()
    return _packet_out(packet, user, items, progress)


@router.post("/{user_id}/hire-onboarding", response_model=HirePacketOut)
async def ensure_worker_hire_onboarding(
    db: Db,
    _: RosterPageUser,
    cid: CompanyId,
    user_id: str,
) -> HirePacketOut:
    user = await _roster_user_in_company_any_status(db, cid, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Worker not found")
    packet, items, progress = await ensure_packet_for_user(db, company_id=cid, user=user)
    await db.commit()
    return _packet_out(packet, user, items, progress)


@router.post("/{user_id}/hire-onboarding/items/{item_id}/complete", response_model=HirePacketOut)
async def complete_worker_hire_onboarding_item(
    db: Db,
    actor: RosterPageUser,
    cid: CompanyId,
    user_id: str,
    item_id: str,
    body: HireCompleteItemIn | None = None,
) -> HirePacketOut:
    user = await _roster_user_in_company_any_status(db, cid, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Worker not found")
    packet = await get_packet_for_user(db, cid, user_id)
    if not packet:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No hire onboarding packet")
    item = await db.get(PulseHireOnboardingItem, item_id)
    if not item or str(item.packet_id) != str(packet.id) or str(item.company_id) != cid:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document item not found")
    payload = body or HireCompleteItemIn()
    try:
        await complete_item(
            db,
            item=item,
            actor=actor,
            signature_name=payload.signature_name,
            signed_ack=payload.signed_ack,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    items, progress = await refresh_packet_progress(db, packet)
    await db.commit()
    return _packet_out(packet, user, items, progress)
