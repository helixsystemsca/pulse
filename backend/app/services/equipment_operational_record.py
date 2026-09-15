"""Asset operational record for QR scan: asset → SOPs → PMs → work history → emergency."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.domain import FacilityEquipment, QrResource, Zone
from app.models.ops_foundation_models import OpsContact, OpsFacility, OpsKnowledgeArticle
from app.models.pm_models import PmTask
from app.models.pulse_models import PulseProcedure, PulseWorkRequest
from app.services.qr_resource_service import _uuid_pk, build_qr_url


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _status_val(v: Any) -> str:
    return str(getattr(v, "value", v) or "")


async def _linked_qr(db: AsyncSession, company_id: str, equipment_id: str) -> Optional[QrResource]:
    return (
        await db.execute(
            select(QrResource).where(
                QrResource.company_id == company_id,
                QrResource.resource_type == "equipment",
                QrResource.resource_id == equipment_id,
            )
        )
    ).scalars().first()


async def _sops_for_equipment(
    db: AsyncSession, company_id: str, eq: FacilityEquipment
) -> list[dict[str, Any]]:
    tokens = [t for t in (eq.type, eq.name) if t]
    stmt = (
        select(PulseProcedure)
        .where(
            PulseProcedure.company_id == company_id,
            PulseProcedure.is_active.is_(True),
        )
        .order_by(PulseProcedure.is_critical.desc(), PulseProcedure.title.asc())
        .limit(40)
    )
    rows = list((await db.execute(stmt)).scalars().all())
    type_l = (eq.type or "").lower()
    name_l = (eq.name or "").lower()
    matched: list[PulseProcedure] = []
    for p in rows:
        hay = " ".join(
            [
                p.title or "",
                p.procedure_category or "",
                " ".join(str(x) for x in (p.search_keywords or [])),
            ]
        ).lower()
        if any(tok.lower() in hay for tok in tokens if len(tok) > 2):
            matched.append(p)
            continue
        if type_l and type_l in hay:
            matched.append(p)
            continue
        # Ice plant / ammonia / pool keywords
        if any(k in name_l or k in type_l for k in ("ammonia", "ice plant", "refrigerat", "zamboni", "resurfacer")):
            if any(k in hay for k in ("ammonia", "ice plant", "refrigerat")):
                matched.append(p)
        if any(k in name_l or k in type_l for k in ("pool", "pump", "chemical", "aquatic")):
            if any(k in hay for k in ("pool", "aquatic", "water quality", "drowning")):
                matched.append(p)
    # Always include critical emergency procedures tagged for the site
    for p in rows:
        if p.is_critical and p not in matched and (p.procedure_category or "").lower() in {
            "emergency",
            "emergency procedures",
        }:
            matched.append(p)
    out = []
    for p in matched[:12]:
        steps = p.steps if isinstance(p.steps, list) else []
        out.append(
            {
                "id": str(p.id),
                "title": p.title,
                "href": f"/training/learning/library?procedure={p.id}",
                "is_critical": bool(p.is_critical),
                "category": p.procedure_category,
                "kind": "internal_procedure",
                "step_count": len(steps),
            }
        )
    return out


async def _emergency_block(
    db: AsyncSession, company_id: str, eq: FacilityEquipment, zone: Optional[Zone]
) -> dict[str, Any]:
    facility: Optional[OpsFacility] = None
    if getattr(eq, "ops_facility_id", None):
        facility = await db.get(OpsFacility, eq.ops_facility_id)
        if facility and facility.company_id != company_id:
            facility = None
    if facility is None and zone is not None:
        facility = (
            await db.execute(
                select(OpsFacility).where(
                    OpsFacility.company_id == company_id,
                    OpsFacility.title.ilike(f"%{zone.name}%"),
                )
            )
        ).scalars().first()

    articles = list(
        (
            await db.execute(
                select(OpsKnowledgeArticle)
                .where(
                    OpsKnowledgeArticle.company_id == company_id,
                    OpsKnowledgeArticle.status == "active",
                    or_(
                        OpsKnowledgeArticle.category.ilike("%emergency%"),
                        OpsKnowledgeArticle.tags.contains(["emergency"]),
                    ),
                )
                .order_by(OpsKnowledgeArticle.title.asc())
                .limit(12)
            )
        ).scalars().all()
    )
    contacts = list(
        (
            await db.execute(
                select(OpsContact).where(
                    OpsContact.company_id == company_id,
                    OpsContact.status == "active",
                    OpsContact.contact_type.in_(("emergency", "contractor", "utility")),
                )
            )
        ).scalars().all()
    )
    return {
        "facility_id": str(facility.id) if facility else None,
        "facility_name": facility.title if facility else (zone.name if zone else None),
        "emergency_procedures": facility.emergency_procedures if facility else None,
        "source": "internal_procedure",
        "disclaimer": (
            "Internal operating procedure — not a regulatory citation. "
            "Follow the City emergency plan and call 911 for life safety."
        ),
        "articles": [
            {
                "id": str(a.id),
                "title": a.title,
                "href": f"/recreation/knowledge?id={a.id}",
                "category": a.category,
            }
            for a in articles
        ],
        "contacts": [
            {
                "id": str(c.id),
                "title": c.title,
                "phone": c.phone,
                "organization": c.organization,
                "contact_type": c.contact_type,
                "href": f"/recreation/contacts?id={c.id}",
            }
            for c in contacts[:8]
        ],
        "href": "/recreation/emergency",
    }


async def equipment_operational_record(
    db: AsyncSession,
    company_id: str,
    equipment_id: str,
    *,
    guest: bool = False,
) -> Optional[dict[str, Any]]:
    pk = _uuid_pk(equipment_id)
    if not pk:
        return None
    eq = await db.get(FacilityEquipment, pk)
    if eq is None or eq.company_id != company_id:
        return None
    zone = await db.get(Zone, eq.zone_id) if eq.zone_id else None
    qr = await _linked_qr(db, company_id, equipment_id)

    pms = list(
        (
            await db.execute(
                select(PmTask)
                .where(PmTask.company_id == company_id, PmTask.equipment_id == equipment_id)
                .order_by(PmTask.next_due_at.asc())
            )
        ).scalars().all()
    )
    wrs = list(
        (
            await db.execute(
                select(PulseWorkRequest)
                .where(
                    PulseWorkRequest.company_id == company_id,
                    PulseWorkRequest.equipment_id == equipment_id,
                )
                .order_by(PulseWorkRequest.updated_at.desc())
                .limit(15)
            )
        ).scalars().all()
    )
    sops = await _sops_for_equipment(db, company_id, eq)
    emergency = await _emergency_block(db, company_id, eq, zone)
    now = _now()

    available = {
        "asset": True,
        "sops": bool(sops),
        "pms": bool(pms),
        "work_history": bool(wrs),
        "emergency": bool(
            emergency.get("emergency_procedures") or emergency.get("articles") or emergency.get("contacts")
        ),
    }

    work_history = []
    for w in wrs:
        row = {
            "id": str(w.id),
            "title": w.title,
            "status": _status_val(w.status),
            "priority": _status_val(w.priority),
            "updated_at": w.updated_at,
            "href": "/dashboard/maintenance",
        }
        if not guest:
            row["description"] = w.description
            row["work_order_number"] = w.work_order_number
        work_history.append(row)

    return {
        "resource_type": "equipment",
        "guest": guest,
        "available": available,
        "qr": (
            {
                "token": qr.qr_token,
                "url": build_qr_url(qr.qr_token),
                "guest_access_enabled": qr.guest_access_enabled,
            }
            if qr
            else None
        ),
        "asset": {
            "id": str(eq.id),
            "name": eq.name,
            "type": eq.type,
            "status": _status_val(eq.status),
            "manufacturer": None if guest else eq.manufacturer,
            "model": eq.model,
            "serial_number": None if guest else eq.serial_number,
            "zone_id": eq.zone_id,
            "zone_name": zone.name if zone else None,
            "notes": None if guest else eq.notes,
            "href": f"/equipment/{eq.id}",
        },
        "sops": sops,
        "pms": [
            {
                "id": str(t.id),
                "name": t.name,
                "frequency_type": t.frequency_type,
                "frequency_value": t.frequency_value,
                "next_due_at": t.next_due_at,
                "overdue": bool(t.next_due_at and t.next_due_at < now),
                "href": f"/equipment/{eq.id}",
            }
            for t in pms
        ],
        "work_history": work_history,
        "emergency": emergency,
    }
