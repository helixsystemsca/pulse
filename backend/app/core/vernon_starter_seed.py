"""Idempotent City of Vernon starter records (facilities, assets, PMs, contractors, procedures).

Tenant-scoped. Safe to re-run. Does not create fake staff or fake schedules.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.features.recreation_ops_tenants import VERNON_ADMIN_EMAILS
from app.core.regulatory_reference_catalog import (
    DISCLAIMER as REG_DISCLAIMER,
    LIBRARY_TAG,
    REFERENCE_CARDS,
    SEED_TAG as REG_SEED_TAG,
    seed_tag_for,
)
from app.models.domain import FacilityEquipment, FacilityEquipmentStatus, User, Zone
from app.models.ops_foundation_models import OpsContractor, OpsFacility, OpsKnowledgeArticle, OpsRegulation
from app.models.pm_models import PmTask
from app.models.pulse_models import PulseProcedure, PulseWorkerCertification
from app.models.training_platform_models import TrainingCertification
from app.services.qr_resource_service import ensure_equipment_qr

_log = logging.getLogger("pulse.vernon_seed")
SEED_TAG = "vernon-starter"
INTERNAL_NOTE = (
    "Internal operating procedure for City of Vernon recreation staff. "
    "Not a regulatory citation. Follow the municipal emergency plan and call 911 for life safety."
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _has_tag(tags: Any, key: str) -> bool:
    if not isinstance(tags, list):
        return False
    return key in tags or f"seed-key:{key}" in tags


async def _get_by_title(db: AsyncSession, model: type, company_id: str, title: str):
    return (
        await db.execute(select(model).where(model.company_id == company_id, model.title == title))
    ).scalar_one_or_none()


async def _ensure_facility(db: AsyncSession, company_id: str, spec: dict[str, Any]) -> OpsFacility:
    row = await _get_by_title(db, OpsFacility, company_id, spec["title"])
    if row:
        return row
    row = OpsFacility(
        id=str(uuid4()),
        company_id=company_id,
        title=spec["title"],
        description=spec["description"],
        status="active",
        tags=[SEED_TAG, f"seed-key:{spec['key']}"],
        building_info=spec.get("building_info"),
        mechanical_systems=spec.get("mechanical_systems"),
        emergency_procedures=spec.get("emergency_procedures"),
        notes="Starter facility profile — edit names and details as needed.",
    )
    db.add(row)
    await db.flush()
    return row


async def _ensure_zone(db: AsyncSession, company_id: str, name: str, description: str) -> Zone:
    row = (
        await db.execute(select(Zone).where(Zone.company_id == company_id, Zone.name == name))
    ).scalar_one_or_none()
    if row:
        return row
    row = Zone(id=str(uuid4()), company_id=company_id, name=name, description=description, meta={"seed": SEED_TAG})
    db.add(row)
    await db.flush()
    return row


async def _ensure_equipment(
    db: AsyncSession,
    company_id: str,
    *,
    name: str,
    type_name: str,
    zone_id: Optional[str],
    facility_id: Optional[str],
    notes: str,
) -> FacilityEquipment:
    row = (
        await db.execute(
            select(FacilityEquipment).where(FacilityEquipment.company_id == company_id, FacilityEquipment.name == name)
        )
    ).scalar_one_or_none()
    if row:
        if facility_id and not getattr(row, "ops_facility_id", None):
            row.ops_facility_id = facility_id
        return row
    row = FacilityEquipment(
        id=str(uuid4()),
        company_id=company_id,
        name=name,
        type=type_name,
        zone_id=zone_id,
        ops_facility_id=facility_id,
        status=FacilityEquipmentStatus.active,
        notes=notes,
    )
    db.add(row)
    await db.flush()
    return row


async def _ensure_pm(
    db: AsyncSession,
    company_id: str,
    equipment_id: str,
    *,
    name: str,
    description: str,
    frequency_type: str,
    frequency_value: int,
) -> None:
    existing = (
        await db.execute(
            select(PmTask).where(
                PmTask.company_id == company_id,
                PmTask.equipment_id == equipment_id,
                PmTask.name == name,
            )
        )
    ).scalar_one_or_none()
    if existing:
        return
    now = _utcnow()
    delta = timedelta(days=frequency_value) if frequency_type == "days" else timedelta(weeks=frequency_value)
    db.add(
        PmTask(
            id=str(uuid4()),
            company_id=company_id,
            equipment_id=equipment_id,
            name=name,
            description=description,
            frequency_type=frequency_type,
            frequency_value=frequency_value,
            next_due_at=now + delta,
            auto_create_work_order=True,
        )
    )


async def _ensure_article(db: AsyncSession, company_id: str, spec: dict[str, Any]) -> None:
    row = await _get_by_title(db, OpsKnowledgeArticle, company_id, spec["title"])
    if row:
        return
    db.add(
        OpsKnowledgeArticle(
            id=str(uuid4()),
            company_id=company_id,
            title=spec["title"],
            description=spec.get("description"),
            category="Emergency Procedures",
            body_rich=spec["body"],
            status="active",
            tags=[SEED_TAG, "emergency", spec["key"]],
            notes=INTERNAL_NOTE,
        )
    )


async def _ensure_procedure(db: AsyncSession, company_id: str, spec: dict[str, Any]) -> None:
    row = (
        await db.execute(
            select(PulseProcedure).where(PulseProcedure.company_id == company_id, PulseProcedure.title == spec["title"])
        )
    ).scalar_one_or_none()
    if row:
        return
    db.add(
        PulseProcedure(
            id=str(uuid4()),
            company_id=company_id,
            title=spec["title"],
            steps=spec["steps"],
            search_keywords=spec["keywords"],
            is_critical=True,
            procedure_category="emergency",
            publication_state="published",
            is_active=True,
            published_at=_utcnow(),
            revision_notes=INTERNAL_NOTE,
        )
    )


def _parse_seed_date(raw: str | None) -> date | None:
    if not raw:
        return None
    try:
        return date.fromisoformat(raw[:10])
    except ValueError:
        return None


async def _lookup_procedure_href(db: AsyncSession, company_id: str, title: str) -> Optional[str]:
    row = (
        await db.execute(
            select(PulseProcedure).where(PulseProcedure.company_id == company_id, PulseProcedure.title == title)
        )
    ).scalar_one_or_none()
    if row is None:
        return None
    return f"/training/learning/library?procedure={row.id}"


async def _lookup_knowledge_href(db: AsyncSession, company_id: str, title: str) -> Optional[str]:
    row = await _get_by_title(db, OpsKnowledgeArticle, company_id, title)
    if row is None:
        return None
    return f"/recreation/knowledge?id={row.id}"


async def _resolve_pulse_pointers(db: AsyncSession, company_id: str, pointers: list[Any]) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for raw in pointers or []:
        if not isinstance(raw, dict):
            continue
        label = str(raw.get("label") or "").strip()
        href = str(raw.get("href") or "").strip()
        match_title = str(raw.get("match_title") or "").strip()
        match_kind = str(raw.get("match_kind") or "").strip()
        if match_title and match_kind == "procedure":
            resolved = await _lookup_procedure_href(db, company_id, match_title)
            if resolved:
                href = resolved
            elif not href:
                href = "/standards/procedures"
        elif match_title and match_kind == "knowledge":
            resolved = await _lookup_knowledge_href(db, company_id, match_title)
            if resolved:
                href = resolved
            elif not href:
                href = "/recreation/knowledge"
        if label and href:
            out.append({"label": label, "href": href})
    return out


def _regulation_seed_tags(spec: dict[str, Any]) -> list[str]:
    key = spec["key"]
    return [REG_SEED_TAG, LIBRARY_TAG, seed_tag_for(key), spec.get("topic_category") or "Other"]


def _apply_regulation_catalog_fields(
    row: OpsRegulation,
    spec: dict[str, Any],
    pointers: list[dict[str, str]],
) -> None:
    extra = list(spec.get("extra_sources") or [])
    row.title = spec["title"]
    row.description = spec.get("summary")
    row.status = "active"
    row.tags = _regulation_seed_tags(spec)
    row.notes = REG_DISCLAIMER
    row.authority = spec.get("authority") or spec.get("official_source_name") or ""
    row.regulation_name = spec.get("regulation_name")
    row.summary = spec.get("summary")
    row.requirements = (
        "See the official source linked on this card. Pulse does not reproduce "
        "copyrighted code or standard text, and this summary is not a legal determination."
    )
    row.external_references = extra
    row.topic_category = spec.get("topic_category") or "Other"
    row.classification = spec.get("classification") or "Regulator guidance"
    row.applicability = spec.get("applicability")
    row.official_source_name = spec.get("official_source_name")
    row.official_source_url = spec.get("official_source_url")
    row.verification_status = spec.get("verification_status") or "Unverified"
    row.review_date = _parse_seed_date(spec.get("review_date"))
    row.pulse_pointers = pointers
    row.source_key = spec["key"]


async def _find_seeded_regulation(
    db: AsyncSession, company_id: str, spec: dict[str, Any]
) -> Optional[OpsRegulation]:
    key = spec["key"]
    seed_key = seed_tag_for(key)
    by_slug = (
        await db.execute(
            select(OpsRegulation).where(
                OpsRegulation.company_id == company_id, OpsRegulation.source_key == key
            )
        )
    ).scalar_one_or_none()
    if by_slug is not None:
        return by_slug
    existing_rows = list(
        (await db.execute(select(OpsRegulation).where(OpsRegulation.company_id == company_id))).scalars().all()
    )
    for row in existing_rows:
        tags = row.tags if isinstance(row.tags, list) else []
        if seed_key in tags or key in tags:
            return row
        if row.title == spec["title"] and not row.source_key and not bool(getattr(row, "user_modified", False)):
            return row
    return None


async def _ensure_regulation(db: AsyncSession, company_id: str, spec: dict[str, Any]) -> None:
    """Upsert by stable source_key only when untouched. Never clobber Josh's edits."""
    key = spec["key"]
    row = await _find_seeded_regulation(db, company_id, spec)
    if row is not None:
        if not row.source_key:
            row.source_key = key
        # Archived (or any user edit) stays as Josh left it — do not recreate or overwrite.
        if bool(getattr(row, "user_modified", False)) or (row.status or "") == "archived":
            if (row.status or "") == "archived":
                row.user_modified = True
            return
        pointers = await _resolve_pulse_pointers(db, company_id, spec.get("pulse_pointers") or [])
        _apply_regulation_catalog_fields(row, spec, pointers)
        return
    pointers = await _resolve_pulse_pointers(db, company_id, spec.get("pulse_pointers") or [])
    created = OpsRegulation(
        id=str(uuid4()),
        company_id=company_id,
        source_key=key,
        user_modified=False,
        inspection_frequency=None,
    )
    _apply_regulation_catalog_fields(created, spec, pointers)
    db.add(created)


async def _ensure_contractor(db: AsyncSession, company_id: str, spec: dict[str, Any]) -> None:
    row = await _get_by_title(db, OpsContractor, company_id, spec["title"])
    if row:
        return
    db.add(
        OpsContractor(
            id=str(uuid4()),
            company_id=company_id,
            title=spec["title"],
            company_name=spec["company_name"],
            primary_contact="(placeholder — add contact)",
            trade=spec["trade"],
            services_provided=spec["services"],
            emergency_contact="(placeholder — add after-hours number)",
            preferred_vendor=False,
            status="active",
            tags=[SEED_TAG, "placeholder", spec["key"]],
            notes=(
                "PLACEHOLDER vendor record for Josh to edit. "
                "Replace company name, contacts, insurance, WCB, and tickets with the real contractor."
            ),
            contact_email=None,
            contact_phone=None,
            insurance_carrier=None,
            insurance_policy=None,
            insurance_expiry=None,
            wcb_account=None,
            wcb_expiry=None,
            hourly_rate=None,
            after_hours_rate=None,
            tickets=[],
            safety_docs=[],
            agreements=[],
            serviced_assets=spec.get("assets") or [],
            serviced_facilities=spec.get("facilities") or [],
        )
    )


async def _ensure_cert_catalog(db: AsyncSession, company_id: str) -> None:
    catalog = [
        ("lifeguard", "Lifeguard", "Aquatic", 24),
        ("first-aid", "First Aid", "Safety", 36),
        ("refrigeration-ticket", "Refrigeration Operator / ice plant ticket", "Trade", 36),
        ("whmis", "WHMIS", "Safety", 12),
        ("pool-operator", "Pool Operator", "Aquatic", 24),
    ]
    for slug, title, issuer, months in catalog:
        existing = (
            await db.execute(
                select(TrainingCertification).where(
                    TrainingCertification.company_id == company_id,
                    TrainingCertification.slug == slug,
                )
            )
        ).scalar_one_or_none()
        if existing:
            continue
        db.add(
            TrainingCertification(
                id=str(uuid4()),
                company_id=company_id,
                slug=slug,
                title=title,
                description="Starter certification type — assign expiry on employee records.",
                issuer=issuer,
                validity_months=months,
                is_active=True,
            )
        )


async def _ensure_josh_certs(db: AsyncSession, company_id: str) -> None:
    user = (
        await db.execute(
            select(User).where(
                User.company_id == company_id,
                func.lower(User.email).in_(list(VERNON_ADMIN_EMAILS)),
            )
        )
    ).scalars().first()
    if user is None:
        return
    names = [
        "Lifeguard",
        "First Aid",
        "Refrigeration Operator",
        "WHMIS",
        "Pool Operator",
    ]
    existing = {
        r[0]
        for r in (
            await db.execute(
                select(PulseWorkerCertification.name).where(
                    PulseWorkerCertification.company_id == company_id,
                    PulseWorkerCertification.user_id == user.id,
                )
            )
        ).all()
    }
    for name in names:
        if name in existing:
            continue
        db.add(
            PulseWorkerCertification(
                id=str(uuid4()),
                company_id=company_id,
                user_id=str(user.id),
                name=name,
                expiry_date=None,
            )
        )


FACILITIES = [
    {
        "key": "arena",
        "title": "Vernon Civic Arena",
        "description": "Ice arena and ice plant / ammonia refrigeration.",
        "building_info": "Civic arena — ice pad, plant room, ice resurfacer bay.",
        "mechanical_systems": "Ammonia refrigeration (ice plant), ice resurfacer, HVAC/boiler as applicable.",
        "emergency_procedures": (
            "INTERNAL PROCEDURE (not a regulatory citation).\n"
            "Ammonia / plant: evacuate the plant room, do not enter without training and PPE, "
            "call 911, notify the refrigeration contractor, follow the City emergency plan.\n"
            "Ice plant failure: stop public ice use if conditions are unsafe, secure the plant room, "
            "call the refrigeration vendor, document what you observed."
        ),
    },
    {
        "key": "aquatic",
        "title": "Vernon Aquatic Centre",
        "description": "Indoor aquatic facility — circulation, chemistry, and emergency equipment.",
        "building_info": "Aquatic centre — basins, mechanical/chemical rooms, deck.",
        "mechanical_systems": "Circulation pumps, chemical controller, filters, HVAC as applicable.",
        "emergency_procedures": (
            "INTERNAL PROCEDURE (not a regulatory citation).\n"
            "Drowning / pool emergency: activate the aquatic EAP, call 911, retrieve AED, "
            "clear the water as directed by the EAP, notify the coordinator.\n"
            "Water quality / chemical issue: stop bathing if water is unsafe, isolate chemical rooms, "
            "ventilate if trained to do so, call the pool equipment vendor if the controller or pumps fail."
        ),
    },
    {
        "key": "crc",
        "title": "Vernon Community Recreation Centre",
        "description": "Community recreation centre — multi-use, HVAC/boiler, AED coverage.",
        "building_info": "Community recreation centre — public spaces, mechanical rooms.",
        "mechanical_systems": "Boiler / HVAC and building emergency equipment.",
        "emergency_procedures": (
            "INTERNAL PROCEDURE (not a regulatory citation).\n"
            "Fire: pull station if safe, evacuate, call 911, do not re-enter until directed.\n"
            "Power failure: check emergency lighting, secure moving equipment, follow facility shutdown steps, "
            "notify on-call operations."
        ),
    },
]

EMERGENCY_ARTICLES = [
    {
        "key": "ammonia-release",
        "title": "Ammonia release — internal response",
        "description": "Short actionable steps for the ice plant / ammonia refrigeration room.",
        "body": (
            f"{INTERNAL_NOTE}\n\n"
            "1. Leave the plant room. Do not re-enter without appropriate training and PPE.\n"
            "2. Evacuate anyone in the affected area. Account for staff and public where you can do so safely.\n"
            "3. Call 911 and the site emergency contacts.\n"
            "4. If it is safe from outside the room, isolate energy sources you are trained to isolate.\n"
            "5. Notify the refrigeration / ammonia contractor (see Contractors).\n"
            "6. Do not treat this card as a Technical Safety BC or WorkSafeBC citation — follow the City plan."
        ),
    },
    {
        "key": "pool-emergency",
        "title": "Drowning / pool emergency — internal response",
        "description": "Deck EAP stub for the aquatic centre.",
        "body": (
            f"{INTERNAL_NOTE}\n\n"
            "1. Activate the aquatic emergency action plan (whistle / radio / alarm as trained).\n"
            "2. Call 911.\n"
            "3. Retrieve AED and first-aid kits.\n"
            "4. Follow in-water rescue and CPR protocols you are certified to perform.\n"
            "5. Clear the water if the EAP requires it. Notify the coordinator.\n"
            "6. Record what happened after the scene is stable."
        ),
    },
    {
        "key": "chemical-spill",
        "title": "Chemical spill — internal response",
        "description": "Pool chemical and plant chemical rooms.",
        "body": (
            f"{INTERNAL_NOTE}\n\n"
            "1. Keep people out of the affected room. Ventilate only if you are trained and it is safe.\n"
            "2. Do not mix chemicals. Do not neutralize unless the SDS and your training say to.\n"
            "3. Call 911 if there are injuries, strong fumes, or an uncontrolled release.\n"
            "4. Use SDS and PPE from the chemical storage area.\n"
            "5. Notify the coordinator and the pool equipment vendor if equipment failed."
        ),
    },
    {
        "key": "fire",
        "title": "Fire — internal response",
        "description": "All recreation facilities.",
        "body": (
            f"{INTERNAL_NOTE}\n\n"
            "1. Pull the fire alarm if it is safe to do so.\n"
            "2. Evacuate using posted routes. Do not use elevators.\n"
            "3. Call 911.\n"
            "4. Account for staff and public at the muster point.\n"
            "5. Do not re-enter until the fire department releases the building."
        ),
    },
    {
        "key": "power-failure",
        "title": "Power failure — internal response",
        "description": "Arena, aquatic centre, and community recreation centre.",
        "body": (
            f"{INTERNAL_NOTE}\n\n"
            "1. Check emergency lighting and exit paths.\n"
            "2. Stop equipment that is unsafe to run through a restart (ice resurfacer, lifts, some pumps).\n"
            "3. Follow facility-specific shutdown for ice plant and pool circulation if outage is extended.\n"
            "4. Notify on-call operations. Record start time and affected systems."
        ),
    },
    {
        "key": "ice-plant-failure",
        "title": "Ice plant failure — internal response",
        "description": "Arena refrigeration / ice sheet.",
        "body": (
            f"{INTERNAL_NOTE}\n\n"
            "1. Stop public ice use if the sheet or plant is unsafe.\n"
            "2. Secure the plant room. Do not troubleshoot ammonia equipment unless you are qualified.\n"
            "3. Call the refrigeration contractor.\n"
            "4. Note alarms, odours, unusual noise, and oil/ammonia observations from a safe location.\n"
            "5. Create a work request in Pulse and attach what you saw."
        ),
    },
]

PROCEDURES = [
    {
        "title": "Ammonia release — internal response",
        "keywords": ["ammonia", "ice plant", "refrigeration", "arena", "emergency"],
        "steps": [
            {"title": "Evacuate", "text": "Leave the plant room. Do not re-enter without training and PPE."},
            {"title": "Call 911", "text": "Request emergency services and notify site emergency contacts."},
            {"title": "Contractor", "text": "Call the refrigeration / ammonia contractor on the contractor list."},
            {"title": "Document", "text": "Record observations from a safe location. This is an internal procedure, not a regulation."},
        ],
    },
    {
        "title": "Drowning / pool emergency — internal response",
        "keywords": ["drowning", "pool emergency", "aquatic", "aed", "water"],
        "steps": [
            {"title": "Activate EAP", "text": "Whistle / radio / alarm as trained. Call 911."},
            {"title": "AED and first aid", "text": "Bring AED and first-aid kits to the scene."},
            {"title": "Rescue / CPR", "text": "Perform only the rescues and care you are certified to perform."},
            {"title": "Notify", "text": "Notify the coordinator and record the incident after the scene is stable."},
        ],
    },
    {
        "title": "Chemical spill — internal response",
        "keywords": ["chemical spill", "pool", "sds", "whmis"],
        "steps": [
            {"title": "Isolate", "text": "Keep people out. Do not mix chemicals."},
            {"title": "SDS / PPE", "text": "Use SDS and PPE. Call 911 if there are injuries or uncontrolled fumes."},
            {"title": "Notify", "text": "Notify the coordinator and pool equipment vendor if equipment failed."},
        ],
    },
    {
        "title": "Fire — internal response",
        "keywords": ["fire", "evacuate", "emergency"],
        "steps": [
            {"title": "Alarm and evacuate", "text": "Pull station if safe. Evacuate. Call 911."},
            {"title": "Muster", "text": "Account for staff and public. Do not re-enter until released."},
        ],
    },
    {
        "title": "Power failure — internal response",
        "keywords": ["power failure", "outage", "emergency lighting"],
        "steps": [
            {"title": "Life safety", "text": "Check exits and emergency lighting."},
            {"title": "Equipment", "text": "Stop unsafe equipment. Follow ice plant / pool shutdown if the outage lasts."},
        ],
    },
    {
        "title": "Ice plant failure — internal response",
        "keywords": ["ice plant", "refrigeration", "ammonia", "arena"],
        "steps": [
            {"title": "Public ice", "text": "Stop ice use if the sheet or plant is unsafe."},
            {"title": "Plant room", "text": "Secure the room. Call the refrigeration contractor. Do not work on ammonia unless qualified."},
        ],
    },
]


async def seed_regulatory_reference_cards(db: AsyncSession, company_id: str) -> None:
    """Idempotent Codes & Guidance starter cards. Safe to re-run; skips user-modified rows."""
    for spec in REFERENCE_CARDS:
        await _ensure_regulation(db, company_id, spec)
    await db.flush()


async def seed_vernon_starter_pack(db: AsyncSession, company_id: str) -> dict[str, Any]:
    """Create a small realistic starter set. Idempotent by title/slug."""
    created: dict[str, int] = {}

    fac_rows: dict[str, OpsFacility] = {}
    zone_rows: dict[str, Zone] = {}
    for spec in FACILITIES:
        fac = await _ensure_facility(db, company_id, spec)
        fac_rows[spec["key"]] = fac
        zone = await _ensure_zone(db, company_id, spec["title"], spec["description"])
        zone_rows[spec["key"]] = zone
    created["facilities"] = len(fac_rows)

    assets = [
        ("Ice plant / ammonia refrigeration", "Ice plant", "arena", "Critical ice-making plant. QR on the plant room door."),
        ("Ice resurfacer (Zamboni)", "Ice resurfacer", "arena", "Ice resurfacer — link PMs and work history here."),
        ("Pool circulation pump — basin 1", "Pool pump", "aquatic", "Primary circulation pump."),
        ("Pool circulation pump — basin 2", "Pool pump", "aquatic", "Second basin / spa loop as applicable — edit to match site."),
        ("Chemical controller", "Water chemistry", "aquatic", "Automated chemical controller."),
        ("Boiler / HVAC — CRC", "HVAC", "crc", "Community recreation centre boiler/HVAC."),
        ("AED — aquatic deck", "Emergency equipment", "aquatic", "Public-access AED. Confirm cabinet location."),
        ("AED — arena lobby", "Emergency equipment", "arena", "Public-access AED. Confirm cabinet location."),
    ]
    eq_by_name: dict[str, FacilityEquipment] = {}
    for name, type_name, fac_key, notes in assets:
        eq = await _ensure_equipment(
            db,
            company_id,
            name=name,
            type_name=type_name,
            zone_id=str(zone_rows[fac_key].id),
            facility_id=str(fac_rows[fac_key].id),
            notes=notes,
        )
        eq_by_name[name] = eq
        await ensure_equipment_qr(db, company_id, eq, guest_read_only=True)
    created["assets"] = len(eq_by_name)

    plant = eq_by_name["Ice plant / ammonia refrigeration"]
    await _ensure_pm(
        db,
        company_id,
        str(plant.id),
        name="Daily ice plant rounds",
        description="Walk the plant: leak detection, unusual noise, oil, alarms. Internal rounds — not a code inspection.",
        frequency_type="days",
        frequency_value=1,
    )
    await _ensure_pm(
        db,
        company_id,
        str(plant.id),
        name="Weekly ice plant review",
        description="Weekly look at logs, contractor callouts, and outstanding plant work.",
        frequency_type="weeks",
        frequency_value=1,
    )
    chem = eq_by_name["Chemical controller"]
    await _ensure_pm(
        db,
        company_id,
        str(chem.id),
        name="Daily water quality checks",
        description="Record chemistry against the aquatic centre’s operating targets. Internal checklist.",
        frequency_type="days",
        frequency_value=1,
    )
    pump = eq_by_name["Pool circulation pump — basin 1"]
    await _ensure_pm(
        db,
        company_id,
        str(pump.id),
        name="Daily pump / strainer check",
        description="Confirm circulation, strainers, and obvious leaks.",
        frequency_type="days",
        frequency_value=1,
    )
    created["pms"] = 4

    for spec in EMERGENCY_ARTICLES:
        await _ensure_article(db, company_id, spec)
    for spec in PROCEDURES:
        await _ensure_procedure(db, company_id, spec)
    created["emergency"] = len(EMERGENCY_ARTICLES)

    await seed_regulatory_reference_cards(db, company_id)
    created["regulatory_reference"] = len(REFERENCE_CARDS)

    await _ensure_contractor(
        db,
        company_id,
        {
            "key": "refrig",
            "title": "[PLACEHOLDER] Refrigeration / ammonia plant vendor",
            "company_name": "Replace with refrigeration contractor",
            "trade": "Refrigeration / ammonia",
            "services": "Ice plant, ammonia refrigeration, related emergency callout.",
            "assets": ["Ice plant / ammonia refrigeration"],
            "facilities": ["Vernon Civic Arena"],
        },
    )
    await _ensure_contractor(
        db,
        company_id,
        {
            "key": "pool-eq",
            "title": "[PLACEHOLDER] Pool equipment vendor",
            "company_name": "Replace with pool equipment contractor",
            "trade": "Pool equipment / water chemistry",
            "services": "Pumps, filters, chemical controllers, aquatic mechanical.",
            "assets": ["Pool circulation pump — basin 1", "Chemical controller"],
            "facilities": ["Vernon Aquatic Centre"],
        },
    )
    await _ensure_contractor(
        db,
        company_id,
        {
            "key": "hvac",
            "title": "[PLACEHOLDER] HVAC / boiler vendor",
            "company_name": "Replace with HVAC contractor",
            "trade": "HVAC / boiler",
            "services": "Boiler, HVAC, related building mechanical.",
            "assets": ["Boiler / HVAC — CRC"],
            "facilities": ["Vernon Community Recreation Centre"],
        },
    )
    created["contractors"] = 3

    await _ensure_cert_catalog(db, company_id)
    await _ensure_josh_certs(db, company_id)
    created["cert_types"] = 5

    from app.services.ops_command_service import ensure_system_templates

    await ensure_system_templates(db)
    created["seasonal_templates"] = 3

    await db.flush()
    _log.info("Vernon starter pack seeded for company %s: %s", company_id, created)
    return created
