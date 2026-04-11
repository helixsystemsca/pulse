"""Facility equipment registry — `/api/v1/equipment`. Tenant-scoped; feature-gated as `equipment`."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Annotated, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from starlette.responses import Response
from sqlalchemy import Select, and_, asc, case, delete, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_company_user, get_db, require_manager_or_above
from app.core.pulse_storage import (
    read_equipment_image_bytes,
    read_part_image_bytes,
    write_equipment_image_bytes,
    write_part_image_bytes,
)
from app.models.domain import EquipmentPart, FacilityEquipment, FacilityEquipmentStatus, User, Zone
from app.models.pulse_models import PulseWorkRequest
from app.schemas.equipment_part import (
    EquipmentImageUploadOut,
    EquipmentPartCreateIn,
    EquipmentPartImageUploadOut,
    EquipmentPartOut,
    EquipmentPartPatchIn,
)
from app.schemas.facility_equipment import (
    EquipmentLinkedWorkOrderOut,
    FacilityEquipmentCreateIn,
    FacilityEquipmentDetailOut,
    FacilityEquipmentOut,
    FacilityEquipmentPatchIn,
)
from app.services.equipment_part_logic import derive_next_replacement_date, part_maintenance_status
from app.services.onboarding_service import try_mark_onboarding_step

router = APIRouter(prefix="/equipment", tags=["equipment"])

Db = Annotated[AsyncSession, Depends(get_db)]
TenantUser = Annotated[User, Depends(get_current_company_user)]
MutatorUser = Annotated[User, Depends(require_manager_or_above)]

_MAX_IMAGE_BYTES = 5 * 1024 * 1024
_CT_EXT = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def _equipment_image_internal_url(equipment_id: str) -> str:
    return f"/api/v1/equipment/{equipment_id}/image"


def _part_image_internal_url(part_id: str) -> str:
    return f"/api/v1/equipment/parts/{part_id}/image"


async def _save_equipment_image_upload(file: UploadFile, company_id: str, equipment_id: str) -> None:
    ct = (file.content_type or "").split(";")[0].strip().lower()
    if ct not in _CT_EXT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upload a JPEG, PNG, or WebP image (max 5MB)",
        )
    raw = await file.read()
    if len(raw) > _MAX_IMAGE_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image too large (max 5MB)")
    ext = _CT_EXT[ct]
    try:
        await write_equipment_image_bytes(company_id, equipment_id, ext, raw, ct)
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)) from e


async def _save_part_image_upload(file: UploadFile, company_id: str, part_id: str) -> None:
    ct = (file.content_type or "").split(";")[0].strip().lower()
    if ct not in _CT_EXT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upload a JPEG, PNG, or WebP image (max 5MB)",
        )
    raw = await file.read()
    if len(raw) > _MAX_IMAGE_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image too large (max 5MB)")
    ext = _CT_EXT[ct]
    try:
        await write_part_image_bytes(company_id, part_id, ext, raw, ct)
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)) from e


def _row_to_out(
    row: FacilityEquipment,
    zone_name: str | None,
    *,
    parts_overdue_count: int = 0,
    parts_due_soon_count: int = 0,
) -> FacilityEquipmentOut:
    return FacilityEquipmentOut(
        id=row.id,
        company_id=row.company_id,
        name=row.name,
        type=row.type,
        zone_id=row.zone_id,
        zone_name=zone_name,
        status=row.status.value,
        manufacturer=row.manufacturer,
        model=row.model,
        serial_number=row.serial_number,
        installation_date=row.installation_date,
        last_service_date=row.last_service_date,
        next_service_date=row.next_service_date,
        service_interval_days=row.service_interval_days,
        notes=row.notes,
        image_url=row.image_url,
        parts_overdue_count=parts_overdue_count,
        parts_due_soon_count=parts_due_soon_count,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


async def _part_counts_by_equipment(db: AsyncSession, company_id: str) -> dict[str, tuple[int, int]]:
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
    stmt = (
        select(EquipmentPart.equipment_id, overdue_sum, due_soon_sum)
        .where(
            EquipmentPart.company_id == company_id,
            EquipmentPart.next_replacement_date.isnot(None),
        )
        .group_by(EquipmentPart.equipment_id)
    )
    res = await db.execute(stmt)
    return {str(r[0]): (int(r[1] or 0), int(r[2] or 0)) for r in res.all()}


def _part_to_out(p: EquipmentPart, today: date) -> EquipmentPartOut:
    return EquipmentPartOut(
        id=p.id,
        company_id=p.company_id,
        equipment_id=p.equipment_id,
        name=p.name,
        description=p.description,
        quantity=p.quantity,
        replacement_interval_days=p.replacement_interval_days,
        last_replaced_date=p.last_replaced_date,
        next_replacement_date=p.next_replacement_date,
        notes=p.notes,
        image_url=p.image_url,
        maintenance_status=part_maintenance_status(p.next_replacement_date, today=today),
        created_at=p.created_at,
        updated_at=p.updated_at,
    )


async def _validate_zone(db: AsyncSession, company_id: str, zone_id: str | None) -> None:
    if zone_id is None:
        return
    z = await db.get(Zone, zone_id)
    if not z or str(z.company_id) != str(company_id):
        raise HTTPException(status_code=400, detail="Invalid zone for this company")


async def _get_equipment_or_404(db: AsyncSession, company_id: str, equipment_id: str) -> FacilityEquipment:
    row = await db.get(FacilityEquipment, equipment_id)
    if not row or str(row.company_id) != str(company_id):
        raise HTTPException(status_code=404, detail="Equipment not found")
    return row


async def _get_part_or_404(db: AsyncSession, company_id: str, part_id: str) -> EquipmentPart:
    row = await db.get(EquipmentPart, part_id)
    if not row or str(row.company_id) != str(company_id):
        raise HTTPException(status_code=404, detail="Part not found")
    return row


@router.get("", response_model=list[FacilityEquipmentOut])
async def list_equipment(
    user: TenantUser,
    db: Db,
    q: Optional[str] = Query(None, description="Search name, type, serial, model"),
    zone_id: Optional[str] = Query(None),
    type: Optional[str] = Query(None, description="Filter by equipment type/category"),
    status: Optional[str] = Query(None, pattern="^(active|maintenance|offline)$"),
    sort: str = Query("name", pattern="^(name|type|status|last_service_date|updated_at|zone_name)$"),
    order: str = Query("asc", pattern="^(asc|desc)$"),
) -> list[FacilityEquipmentOut]:
    cid = str(user.company_id)
    counts = await _part_counts_by_equipment(db, cid)
    zn = Zone.name.label("zone_name")
    stmt: Select = (
        select(FacilityEquipment, zn)
        .outerjoin(Zone, Zone.id == FacilityEquipment.zone_id)
        .where(FacilityEquipment.company_id == cid)
    )
    if q and q.strip():
        term = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(FacilityEquipment.name).like(term),
                func.lower(FacilityEquipment.type).like(term),
                func.lower(func.coalesce(FacilityEquipment.serial_number, "")).like(term),
                func.lower(func.coalesce(FacilityEquipment.model, "")).like(term),
            )
        )
    if zone_id:
        stmt = stmt.where(FacilityEquipment.zone_id == zone_id)
    if type and type.strip():
        stmt = stmt.where(FacilityEquipment.type == type.strip())
    if status:
        stmt = stmt.where(FacilityEquipment.status == FacilityEquipmentStatus(status))

    order_fn = asc if order == "asc" else desc
    if sort == "zone_name":
        stmt = stmt.order_by(order_fn(zn), asc(FacilityEquipment.name))
    elif sort == "name":
        stmt = stmt.order_by(order_fn(FacilityEquipment.name))
    elif sort == "type":
        stmt = stmt.order_by(order_fn(FacilityEquipment.type), asc(FacilityEquipment.name))
    elif sort == "status":
        stmt = stmt.order_by(order_fn(FacilityEquipment.status), asc(FacilityEquipment.name))
    elif sort == "last_service_date":
        stmt = stmt.order_by(order_fn(FacilityEquipment.last_service_date), asc(FacilityEquipment.name))
    else:
        stmt = stmt.order_by(order_fn(FacilityEquipment.updated_at), asc(FacilityEquipment.name))

    res = await db.execute(stmt)
    rows = res.all()
    out: list[FacilityEquipmentOut] = []
    for r in rows:
        eq = r[0]
        po, ps = counts.get(eq.id, (0, 0))
        out.append(_row_to_out(eq, r[1], parts_overdue_count=po, parts_due_soon_count=ps))
    return out


@router.patch("/parts/{part_id}", response_model=EquipmentPartOut)
async def patch_equipment_part(
    part_id: str,
    body: EquipmentPartPatchIn,
    user: MutatorUser,
    db: Db,
) -> EquipmentPartOut:
    cid = str(user.company_id)
    row = await _get_part_or_404(db, cid, part_id)
    raw = body.model_dump(exclude_unset=True)
    next_sent = "next_replacement_date" in raw
    next_val = raw.pop("next_replacement_date", None) if next_sent else None
    recompute = "last_replaced_date" in raw or "replacement_interval_days" in raw
    for k, v in raw.items():
        if k == "notes" and isinstance(v, str):
            v = v.strip() or None
        elif k == "description" and isinstance(v, str):
            v = v.strip() or None
        elif k == "name" and isinstance(v, str):
            v = v.strip()
        setattr(row, k, v)
    if next_sent:
        row.next_replacement_date = next_val
    elif recompute:
        row.next_replacement_date = derive_next_replacement_date(
            row.last_replaced_date, row.replacement_interval_days
        )
    row.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(row)
    today = datetime.now(timezone.utc).date()
    return _part_to_out(row, today)


@router.delete("/parts/{part_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_equipment_part(
    part_id: str,
    user: MutatorUser,
    db: Db,
) -> None:
    cid = str(user.company_id)
    row = await _get_part_or_404(db, cid, part_id)
    await db.execute(delete(EquipmentPart).where(EquipmentPart.id == row.id))
    await db.commit()


@router.get("/parts/{part_id}/image")
async def get_part_image_file(
    part_id: str,
    user: TenantUser,
    db: Db,
) -> Response:
    cid = str(user.company_id)
    await _get_part_or_404(db, cid, part_id)
    try:
        blob = await read_part_image_bytes(cid, part_id)
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)) from e
    if not blob:
        raise HTTPException(status_code=404, detail="No image for this part")
    data, media_type = blob
    return Response(content=data, media_type=media_type, headers={"Cache-Control": "private, no-store"})


@router.post("/parts/{part_id}/image", response_model=EquipmentPartImageUploadOut)
async def upload_part_image(
    part_id: str,
    user: MutatorUser,
    db: Db,
    file: UploadFile = File(...),
) -> EquipmentPartImageUploadOut:
    cid = str(user.company_id)
    row = await _get_part_or_404(db, cid, part_id)
    await _save_part_image_upload(file, cid, part_id)
    internal = _part_image_internal_url(part_id)
    row.image_url = internal
    row.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(row)
    return EquipmentPartImageUploadOut(image_url=internal)


@router.get("/{equipment_id}/parts", response_model=list[EquipmentPartOut])
async def list_equipment_parts(
    equipment_id: str,
    user: TenantUser,
    db: Db,
) -> list[EquipmentPartOut]:
    cid = str(user.company_id)
    await _get_equipment_or_404(db, cid, equipment_id)
    q = await db.execute(
        select(EquipmentPart)
        .where(EquipmentPart.company_id == cid, EquipmentPart.equipment_id == equipment_id)
        .order_by(EquipmentPart.name)
    )
    today = datetime.now(timezone.utc).date()
    return [_part_to_out(p, today) for p in q.scalars().all()]


@router.post("/{equipment_id}/parts", response_model=EquipmentPartOut, status_code=status.HTTP_201_CREATED)
async def create_equipment_part(
    equipment_id: str,
    body: EquipmentPartCreateIn,
    user: MutatorUser,
    db: Db,
) -> EquipmentPartOut:
    cid = str(user.company_id)
    eq = await _get_equipment_or_404(db, cid, equipment_id)
    next_dt = body.next_replacement_date
    if next_dt is None:
        next_dt = derive_next_replacement_date(body.last_replaced_date, body.replacement_interval_days)
    row = EquipmentPart(
        id=str(uuid4()),
        company_id=cid,
        equipment_id=eq.id,
        name=body.name.strip(),
        description=body.description.strip() if body.description else None,
        quantity=body.quantity,
        replacement_interval_days=body.replacement_interval_days,
        last_replaced_date=body.last_replaced_date,
        next_replacement_date=next_dt,
        notes=body.notes.strip() if body.notes else None,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    today = datetime.now(timezone.utc).date()
    return _part_to_out(row, today)


@router.get("/{equipment_id}/image")
async def get_equipment_image_file(
    equipment_id: str,
    user: TenantUser,
    db: Db,
) -> Response:
    cid = str(user.company_id)
    await _get_equipment_or_404(db, cid, equipment_id)
    try:
        blob = await read_equipment_image_bytes(cid, equipment_id)
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)) from e
    if not blob:
        raise HTTPException(status_code=404, detail="No image for this equipment")
    data, media_type = blob
    return Response(content=data, media_type=media_type, headers={"Cache-Control": "private, no-store"})


@router.post("/{equipment_id}/image", response_model=EquipmentImageUploadOut)
async def upload_equipment_image(
    equipment_id: str,
    user: MutatorUser,
    db: Db,
    file: UploadFile = File(...),
) -> EquipmentImageUploadOut:
    cid = str(user.company_id)
    row = await _get_equipment_or_404(db, cid, equipment_id)
    await _save_equipment_image_upload(file, cid, equipment_id)
    internal = _equipment_image_internal_url(equipment_id)
    row.image_url = internal
    row.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(row)
    return EquipmentImageUploadOut(image_url=internal)


@router.get("/{equipment_id}", response_model=FacilityEquipmentDetailOut)
async def get_equipment(
    equipment_id: str,
    user: TenantUser,
    db: Db,
) -> FacilityEquipmentDetailOut:
    cid = str(user.company_id)
    zn = Zone.name.label("zone_name")
    stmt = (
        select(FacilityEquipment, zn)
        .outerjoin(Zone, Zone.id == FacilityEquipment.zone_id)
        .where(FacilityEquipment.company_id == cid, FacilityEquipment.id == equipment_id)
    )
    res = await db.execute(stmt)
    row = res.first()
    if not row:
        raise HTTPException(status_code=404, detail="Equipment not found")
    counts = await _part_counts_by_equipment(db, cid)
    po, ps = counts.get(row[0].id, (0, 0))
    base = _row_to_out(row[0], row[1], parts_overdue_count=po, parts_due_soon_count=ps)
    wo_q = await db.execute(
        select(PulseWorkRequest)
        .where(PulseWorkRequest.company_id == cid, PulseWorkRequest.equipment_id == equipment_id)
        .order_by(PulseWorkRequest.updated_at.desc())
        .limit(25),
    )
    related = [
        EquipmentLinkedWorkOrderOut(
            id=w.id,
            title=w.title,
            status=w.status.value if hasattr(w.status, "value") else str(w.status),
            updated_at=w.updated_at,
        )
        for w in wo_q.scalars().all()
    ]
    needs = po > 0 or ps > 0
    return FacilityEquipmentDetailOut(
        **base.model_dump(),
        related_work_orders=related,
        parts_needs_maintenance=needs,
    )


@router.post("", response_model=FacilityEquipmentOut, status_code=status.HTTP_201_CREATED)
async def create_equipment(
    body: FacilityEquipmentCreateIn,
    user: MutatorUser,
    db: Db,
) -> FacilityEquipmentOut:
    cid = str(user.company_id)
    await _validate_zone(db, cid, body.zone_id)
    try:
        st = FacilityEquipmentStatus(body.status)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid status")

    row = FacilityEquipment(
        company_id=cid,
        name=body.name.strip(),
        type=(body.type or "General").strip() or "General",
        zone_id=body.zone_id,
        status=st,
        manufacturer=body.manufacturer.strip() if body.manufacturer else None,
        model=body.model.strip() if body.model else None,
        serial_number=body.serial_number.strip() if body.serial_number else None,
        installation_date=body.installation_date,
        last_service_date=body.last_service_date,
        next_service_date=body.next_service_date,
        service_interval_days=body.service_interval_days,
        notes=body.notes.strip() if body.notes else None,
    )
    db.add(row)
    await db.flush()
    await try_mark_onboarding_step(db, user.id, "add_equipment")
    zn_val: str | None = None
    if row.zone_id:
        z = await db.get(Zone, row.zone_id)
        zn_val = z.name if z else None
    await db.commit()
    await db.refresh(row)
    return _row_to_out(row, zn_val)


@router.patch("/{equipment_id}", response_model=FacilityEquipmentOut)
async def patch_equipment(
    equipment_id: str,
    body: FacilityEquipmentPatchIn,
    user: MutatorUser,
    db: Db,
) -> FacilityEquipmentOut:
    cid = str(user.company_id)
    row = await _get_equipment_or_404(db, cid, equipment_id)
    data = body.model_dump(exclude_unset=True)
    if "zone_id" in data:
        await _validate_zone(db, cid, data["zone_id"])
    st_raw = data.pop("status", None)
    if st_raw is not None:
        try:
            row.status = FacilityEquipmentStatus(st_raw)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid status")
    for k, v in data.items():
        if k in ("manufacturer", "model", "serial_number", "notes") and isinstance(v, str):
            v = v.strip() or None
        setattr(row, k, v)
    row.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(row)
    zn_val: str | None = None
    if row.zone_id:
        z = await db.get(Zone, row.zone_id)
        zn_val = z.name if z else None
    counts = await _part_counts_by_equipment(db, cid)
    po, ps = counts.get(row.id, (0, 0))
    return _row_to_out(row, zn_val, parts_overdue_count=po, parts_due_soon_count=ps)


@router.delete("/{equipment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_equipment(
    equipment_id: str,
    user: MutatorUser,
    db: Db,
) -> None:
    cid = str(user.company_id)
    row = await _get_equipment_or_404(db, cid, equipment_id)
    await db.execute(delete(FacilityEquipment).where(FacilityEquipment.id == row.id))
    await db.commit()
