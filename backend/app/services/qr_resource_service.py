"""QR resource CRUD, resolution, and resource option loading."""

from __future__ import annotations

import secrets
import string
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.qr_guest_access import is_guest_read_only_enabled, redact_guest_payload
from app.core.qr_resource_types import (
    ALL_GUEST_ACCESS_LEVELS,
    GUEST_ACCESS_NONE,
    QR_RESOURCE_TYPE_REGISTRY,
    destination_for,
    normalize_guest_access_level,
    normalize_resource_type,
)
from app.models.domain import FacilityEquipment, QrResource, Zone
from app.models.facility_map_models import FacilityMap
from app.models.pulse_models import PulseProcedure


def _token_alphabet() -> str:
    return string.ascii_uppercase + string.digits


def generate_qr_token(existing: set[str], *, length: int = 10) -> str:
    alphabet = _token_alphabet()
    for _ in range(64):
        token = "".join(secrets.choice(alphabet) for _ in range(length))
        if token not in existing:
            return token
    raise HTTPException(status_code=500, detail="Unable to generate unique QR token")


def build_qr_url(token: str) -> str:
    settings = get_settings()
    base = (settings.pulse_app_public_url or "").rstrip("/")
    if not base:
        return f"/qr/{token}"
    return f"{base}/qr/{token}"


async def _existing_tokens(db: AsyncSession, company_id: str) -> set[str]:
    q = await db.execute(select(QrResource.qr_token).where(QrResource.company_id == company_id))
    return {row[0] for row in q.all() if row[0]}


async def _linked_resource_label(
    db: AsyncSession,
    company_id: str,
    resource_type: str,
    resource_id: str,
) -> Optional[str]:
    if resource_type in ("inventory_zone", "location", "room", "cabinet", "fridge"):
        row = await db.get(Zone, resource_id)
        if row and row.company_id == company_id:
            return row.name
        return None
    if resource_type == "equipment":
        row = await db.get(FacilityEquipment, resource_id)
        if row and row.company_id == company_id:
            return row.name
        return None
    if resource_type == "procedure":
        row = await db.get(PulseProcedure, resource_id)
        if row and row.company_id == company_id:
            return row.title
        return None
    if resource_type == "drawing":
        row = await db.get(FacilityMap, resource_id)
        if row and row.company_id == company_id:
            return row.name
        return None
    if resource_type == "vehicle":
        return f"Vehicle {resource_id[:8]}"
    return None


async def _validate_resource_exists(
    db: AsyncSession,
    company_id: str,
    resource_type: str,
    resource_id: str,
) -> None:
    label = await _linked_resource_label(db, company_id, resource_type, resource_id)
    if label is None and resource_type != "vehicle":
        raise HTTPException(status_code=400, detail="Linked resource not found for this tenant")


async def _guest_payload(
    db: AsyncSession,
    company_id: str,
    resource_type: str,
    resource_id: str,
) -> dict[str, Any]:
    if resource_type in ("inventory_zone", "location", "room", "cabinet", "fridge"):
        zone = await db.get(Zone, resource_id)
        if zone is None or zone.company_id != company_id:
            return {}
        return redact_guest_payload(
            {
                "name": zone.name,
                "description": zone.description,
                "resource_type": resource_type,
            }
        )
    if resource_type == "equipment":
        eq = await db.get(FacilityEquipment, resource_id)
        if eq is None or eq.company_id != company_id:
            return {}
        return redact_guest_payload(
            {
                "name": eq.name,
                "type": eq.type,
                "status": str(eq.status),
                "zone_id": eq.zone_id,
                "resource_type": resource_type,
            }
        )
    if resource_type == "procedure":
        proc = await db.get(PulseProcedure, resource_id)
        if proc is None or proc.company_id != company_id:
            return {}
        return redact_guest_payload(
            {
                "title": proc.title,
                "publication_state": proc.publication_state,
                "resource_type": resource_type,
            }
        )
    if resource_type == "drawing":
        mp = await db.get(FacilityMap, resource_id)
        if mp is None or mp.company_id != company_id:
            return {}
        return redact_guest_payload(
            {
                "name": mp.name,
                "resource_type": resource_type,
            }
        )
    return {"resource_type": resource_type, "resource_id": resource_id}


def _serialize(row: QrResource, *, linked_label: Optional[str] = None) -> dict[str, Any]:
    return {
        "id": row.id,
        "tenant_id": row.company_id,
        "name": row.name,
        "description": row.description,
        "resource_type": row.resource_type,
        "resource_id": row.resource_id,
        "qr_token": row.qr_token,
        "qr_url": build_qr_url(row.qr_token),
        "guest_access_enabled": row.guest_access_enabled,
        "guest_access_level": row.guest_access_level,
        "linked_resource_label": linked_label,
        "created_by": row.created_by_user_id,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


async def list_qr_resources(
    db: AsyncSession,
    company_id: str,
    *,
    q: Optional[str] = None,
    resource_type: Optional[str] = None,
) -> list[dict[str, Any]]:
    stmt = select(QrResource).where(QrResource.company_id == company_id)
    if resource_type:
        rtype = normalize_resource_type(resource_type)
        if rtype:
            stmt = stmt.where(QrResource.resource_type == rtype)
    if q:
        needle = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                QrResource.name.ilike(needle),
                QrResource.description.ilike(needle),
                QrResource.qr_token.ilike(needle),
            )
        )
    stmt = stmt.order_by(QrResource.created_at.desc())
    rows = list((await db.execute(stmt)).scalars().all())
    out = []
    for row in rows:
        label = await _linked_resource_label(db, company_id, row.resource_type, row.resource_id)
        out.append(_serialize(row, linked_label=label))
    return out


async def get_qr_resource(db: AsyncSession, company_id: str, qr_id: str) -> dict[str, Any]:
    row = await db.get(QrResource, qr_id)
    if row is None or row.company_id != company_id:
        raise HTTPException(status_code=404, detail="QR resource not found")
    label = await _linked_resource_label(db, company_id, row.resource_type, row.resource_id)
    return _serialize(row, linked_label=label)


async def get_qr_resource_by_token(db: AsyncSession, token: str) -> QrResource:
    q = await db.execute(select(QrResource).where(QrResource.qr_token == token.strip().upper()))
    row = q.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="QR code not found")
    return row


async def create_qr_resource(
    db: AsyncSession,
    company_id: str,
    user_id: Optional[str],
    *,
    name: str,
    description: Optional[str],
    resource_type: str,
    resource_id: str,
    guest_access_enabled: bool,
    guest_access_level: str,
) -> dict[str, Any]:
    rtype = normalize_resource_type(resource_type)
    if rtype is None:
        raise HTTPException(status_code=400, detail="Unsupported resource type")
    level = normalize_guest_access_level(guest_access_level)
    if level not in ALL_GUEST_ACCESS_LEVELS:
        raise HTTPException(status_code=400, detail="Invalid guest access level")
    if not guest_access_enabled:
        level = GUEST_ACCESS_NONE

    await _validate_resource_exists(db, company_id, rtype, resource_id)
    tokens = await _existing_tokens(db, company_id)
    now = datetime.now(timezone.utc)
    row = QrResource(
        id=str(uuid4()),
        company_id=company_id,
        name=name.strip(),
        description=(description or "").strip() or None,
        resource_type=rtype,
        resource_id=resource_id,
        qr_token=generate_qr_token(tokens),
        guest_access_enabled=guest_access_enabled,
        guest_access_level=level,
        created_by_user_id=user_id,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    await db.flush()
    label = await _linked_resource_label(db, company_id, rtype, resource_id)
    return _serialize(row, linked_label=label)


async def patch_qr_resource(
    db: AsyncSession,
    company_id: str,
    qr_id: str,
    *,
    name: Optional[str] = None,
    description: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    guest_access_enabled: Optional[bool] = None,
    guest_access_level: Optional[str] = None,
) -> dict[str, Any]:
    row = await db.get(QrResource, qr_id)
    if row is None or row.company_id != company_id:
        raise HTTPException(status_code=404, detail="QR resource not found")

    if name is not None:
        row.name = name.strip()
    if description is not None:
        row.description = description.strip() or None
    if resource_type is not None:
        rtype = normalize_resource_type(resource_type)
        if rtype is None:
            raise HTTPException(status_code=400, detail="Unsupported resource type")
        row.resource_type = rtype
    if resource_id is not None:
        row.resource_id = resource_id
    if guest_access_enabled is not None:
        row.guest_access_enabled = guest_access_enabled
    if guest_access_level is not None:
        row.guest_access_level = normalize_guest_access_level(guest_access_level)
    if not row.guest_access_enabled:
        row.guest_access_level = GUEST_ACCESS_NONE

    await _validate_resource_exists(db, company_id, row.resource_type, row.resource_id)
    row.updated_at = datetime.now(timezone.utc)
    await db.flush()
    label = await _linked_resource_label(db, company_id, row.resource_type, row.resource_id)
    return _serialize(row, linked_label=label)


async def delete_qr_resource(db: AsyncSession, company_id: str, qr_id: str) -> None:
    row = await db.get(QrResource, qr_id)
    if row is None or row.company_id != company_id:
        raise HTTPException(status_code=404, detail="QR resource not found")
    await db.delete(row)


async def regenerate_qr_token(db: AsyncSession, company_id: str, qr_id: str) -> dict[str, Any]:
    row = await db.get(QrResource, qr_id)
    if row is None or row.company_id != company_id:
        raise HTTPException(status_code=404, detail="QR resource not found")
    tokens = await _existing_tokens(db, company_id)
    tokens.discard(row.qr_token)
    row.qr_token = generate_qr_token(tokens)
    row.updated_at = datetime.now(timezone.utc)
    await db.flush()
    label = await _linked_resource_label(db, company_id, row.resource_type, row.resource_id)
    return _serialize(row, linked_label=label)


async def resolve_qr_token(
    db: AsyncSession,
    token: str,
    *,
    authenticated: bool,
    guest_mode: bool = False,
) -> dict[str, Any]:
    row = await get_qr_resource_by_token(db, token)
    guest_ok = is_guest_read_only_enabled(row.guest_access_enabled, row.guest_access_level)
    dest = destination_for(row.resource_type, row.resource_id, guest=False)
    guest_dest = destination_for(row.resource_type, row.resource_id, guest=True) if guest_ok else None

    requires_auth = not authenticated and not (guest_ok and guest_mode)
    guest_payload = None
    if guest_ok and (guest_mode or not authenticated):
        guest_payload = await _guest_payload(db, row.company_id, row.resource_type, row.resource_id)

    return {
        "qr_token": row.qr_token,
        "name": row.name,
        "description": row.description,
        "resource_type": row.resource_type,
        "resource_id": row.resource_id,
        "destination_path": guest_dest if guest_mode and guest_ok else dest,
        "guest_destination_path": guest_dest,
        "guest_access_enabled": row.guest_access_enabled,
        "guest_access_level": row.guest_access_level,
        "requires_auth": requires_auth,
        "guest_payload": guest_payload,
    }


async def list_resource_options(
    db: AsyncSession,
    company_id: str,
    resource_type: str,
    *,
    q: Optional[str] = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    rtype = normalize_resource_type(resource_type)
    if rtype is None:
        raise HTTPException(status_code=400, detail="Unsupported resource type")

    if rtype in ("inventory_zone", "location", "room", "cabinet", "fridge"):
        stmt = select(Zone).where(Zone.company_id == company_id)
        if q:
            stmt = stmt.where(Zone.name.ilike(f"%{q.strip()}%"))
        stmt = stmt.order_by(Zone.name.asc()).limit(limit)
        rows = list((await db.execute(stmt)).scalars().all())
        return [{"id": z.id, "label": z.name, "subtitle": z.description} for z in rows]

    if rtype == "equipment":
        stmt = select(FacilityEquipment).where(FacilityEquipment.company_id == company_id)
        if q:
            stmt = stmt.where(FacilityEquipment.name.ilike(f"%{q.strip()}%"))
        stmt = stmt.order_by(FacilityEquipment.name.asc()).limit(limit)
        rows = list((await db.execute(stmt)).scalars().all())
        return [{"id": e.id, "label": e.name, "subtitle": e.type} for e in rows]

    if rtype == "procedure":
        stmt = select(PulseProcedure).where(PulseProcedure.company_id == company_id)
        if q:
            stmt = stmt.where(PulseProcedure.title.ilike(f"%{q.strip()}%"))
        stmt = stmt.order_by(PulseProcedure.title.asc()).limit(limit)
        rows = list((await db.execute(stmt)).scalars().all())
        return [{"id": p.id, "label": p.title, "subtitle": p.publication_state} for p in rows]

    if rtype == "drawing":
        stmt = select(FacilityMap).where(FacilityMap.company_id == company_id)
        if q:
            stmt = stmt.where(FacilityMap.name.ilike(f"%{q.strip()}%"))
        stmt = stmt.order_by(FacilityMap.name.asc()).limit(limit)
        rows = list((await db.execute(stmt)).scalars().all())
        return [{"id": m.id, "label": m.name, "subtitle": None} for m in rows]

    if rtype == "vehicle":
        return [
            {"id": "f250", "label": "F250", "subtitle": "Vehicle (scaffold)"},
            {"id": "silverado-ev", "label": "Silverado EV", "subtitle": "Vehicle (scaffold)"},
            {"id": "cruze", "label": "Cruze", "subtitle": "Vehicle (scaffold)"},
        ]

    return []


def resource_type_catalog() -> list[dict[str, str]]:
    return [
        {"key": defn.key, "label": defn.label}
        for defn in QR_RESOURCE_TYPE_REGISTRY.values()
    ]
