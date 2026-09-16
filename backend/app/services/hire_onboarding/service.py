"""Hire-time onboarding packets — progress, template seed, attach, complete."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterable
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import User
from app.models.pulse_models import (
    PulseHireOnboardingItem,
    PulseHireOnboardingPacket,
    PulseHireOnboardingTemplate,
    PulseWorkerHR,
)
from app.services.hire_onboarding.templates import (
    PLANT_ROLE_TOKENS,
    DEFAULT_TEMPLATE_NAME,
    new_template_item_id,
    seeded_template_items,
)

KIND_REVIEW = "review"
KIND_SIGN = "sign"
STATUS_PENDING = "pending"
STATUS_COMPLETED = "completed"
PACKET_OPEN = "open"
PACKET_COMPLETED = "completed"
APPLIES_ALWAYS = "always"
APPLIES_PLANT = "plant_role"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def is_plant_role(
    *,
    department: str | None = None,
    job_title: str | None = None,
    department_slugs: Iterable[str] | None = None,
) -> bool:
    parts = [department or "", job_title or ""]
    if department_slugs:
        parts.extend(str(s) for s in department_slugs)
    hay = " ".join(parts).lower()
    return any(token in hay for token in PLANT_ROLE_TOKENS)


def packet_progress(items: Iterable[PulseHireOnboardingItem] | Iterable[dict[str, Any]]) -> dict[str, Any]:
    """Required-item completion: percent, counts, and derived packet status."""
    required: list[Any] = []
    for item in items:
        is_required = item.is_required if hasattr(item, "is_required") else bool(item.get("is_required", True))
        if is_required:
            required.append(item)
    total = len(required)
    completed = 0
    for item in required:
        status = item.status if hasattr(item, "status") else str(item.get("status") or "")
        if status == STATUS_COMPLETED:
            completed += 1
    percent = 0 if total == 0 else int(round(100 * completed / total))
    derived = PACKET_COMPLETED if total > 0 and completed >= total else PACKET_OPEN
    return {
        "required_total": total,
        "required_completed": completed,
        "percent": percent,
        "status": derived,
    }


def _normalize_kind(raw: object) -> str:
    v = str(raw or "").strip().lower()
    return KIND_SIGN if v == KIND_SIGN else KIND_REVIEW


def _normalize_applies_when(raw: object) -> str:
    v = str(raw or "").strip().lower()
    return APPLIES_PLANT if v in {APPLIES_PLANT, "plant", "plant-role"} else APPLIES_ALWAYS


def _slug_key(title: str, fallback: str) -> str:
    cleaned = "".join(ch.lower() if ch.isalnum() else "-" for ch in title.strip())
    cleaned = "-".join(part for part in cleaned.split("-") if part)[:64]
    return cleaned or fallback


def normalize_template_items(raw_items: object) -> list[dict[str, Any]]:
    if not isinstance(raw_items, list):
        return []
    out: list[dict[str, Any]] = []
    seen_keys: set[str] = set()
    for index, raw in enumerate(raw_items):
        if not isinstance(raw, dict):
            continue
        title = str(raw.get("title") or "").strip()
        if not title:
            continue
        key = str(raw.get("key") or "").strip().lower().replace(" ", "_")[:64]
        if not key:
            key = _slug_key(title, f"item-{index + 1}")
        base_key = key
        n = 2
        while key in seen_keys:
            key = f"{base_key}-{n}"[:64]
            n += 1
        seen_keys.add(key)
        item_id = str(raw.get("id") or "").strip() or new_template_item_id()
        desc = raw.get("description")
        body = raw.get("body_text")
        out.append(
            {
                "id": item_id,
                "key": key,
                "title": title[:255],
                "description": (str(desc).strip()[:2000] if desc else None) or None,
                "kind": _normalize_kind(raw.get("kind")),
                "body_text": (str(body).strip()[:8000] if body else None) or None,
                "applies_when": _normalize_applies_when(raw.get("applies_when")),
                "is_required": bool(raw.get("is_required", True)),
            }
        )
    return out


async def ensure_default_template(db: AsyncSession, company_id: str) -> PulseHireOnboardingTemplate:
    row = (
        await db.execute(
            select(PulseHireOnboardingTemplate).where(PulseHireOnboardingTemplate.company_id == company_id)
        )
    ).scalar_one_or_none()
    if row:
        if not row.items:
            row.items = seeded_template_items()
            row.updated_at = _now()
            await db.flush()
        return row
    row = PulseHireOnboardingTemplate(
        id=str(uuid4()),
        company_id=company_id,
        name=DEFAULT_TEMPLATE_NAME,
        items=seeded_template_items(),
    )
    db.add(row)
    await db.flush()
    return row


async def replace_template_items(
    db: AsyncSession,
    company_id: str,
    *,
    name: str | None,
    items: object,
) -> PulseHireOnboardingTemplate:
    row = await ensure_default_template(db, company_id)
    if name and name.strip():
        row.name = name.strip()[:128]
    row.items = normalize_template_items(items)
    row.updated_at = _now()
    await db.flush()
    return row


async def _hr_for_user(db: AsyncSession, user_id: str) -> PulseWorkerHR | None:
    return await db.get(PulseWorkerHR, user_id)


def _hire_is_plant(hr: PulseWorkerHR | None) -> bool:
    if not hr:
        return False
    slugs = hr.department_slugs if isinstance(hr.department_slugs, list) else None
    return is_plant_role(department=hr.department, job_title=hr.job_title, department_slugs=slugs)


def _items_for_hire(template: PulseHireOnboardingTemplate, *, plant_role: bool) -> list[dict[str, Any]]:
    selected: list[dict[str, Any]] = []
    for spec in normalize_template_items(template.items):
        applies = spec.get("applies_when") or APPLIES_ALWAYS
        if applies == APPLIES_PLANT and not plant_role:
            continue
        selected.append(spec)
    return selected


def _apply_progress_to_packet(packet: PulseHireOnboardingPacket, items: list[PulseHireOnboardingItem]) -> dict[str, Any]:
    progress = packet_progress(items)
    packet.status = progress["status"]
    packet.completed_at = _now() if progress["status"] == PACKET_COMPLETED else None
    packet.updated_at = _now()
    return progress


async def refresh_packet_progress(
    db: AsyncSession, packet: PulseHireOnboardingPacket
) -> tuple[list[PulseHireOnboardingItem], dict[str, Any]]:
    items = await load_packet_items(db, packet.id)
    progress = _apply_progress_to_packet(packet, items)
    await db.flush()
    return items, progress


async def load_packet_items(db: AsyncSession, packet_id: str) -> list[PulseHireOnboardingItem]:
    rows = (
        await db.execute(
            select(PulseHireOnboardingItem)
            .where(PulseHireOnboardingItem.packet_id == packet_id)
            .order_by(PulseHireOnboardingItem.sort_order, PulseHireOnboardingItem.title)
        )
    ).scalars().all()
    return list(rows)


async def get_packet_for_user(
    db: AsyncSession, company_id: str, user_id: str
) -> PulseHireOnboardingPacket | None:
    return (
        await db.execute(
            select(PulseHireOnboardingPacket).where(
                PulseHireOnboardingPacket.company_id == company_id,
                PulseHireOnboardingPacket.user_id == user_id,
            )
        )
    ).scalar_one_or_none()


async def ensure_packet_for_user(
    db: AsyncSession,
    *,
    company_id: str,
    user: User,
) -> tuple[PulseHireOnboardingPacket, list[PulseHireOnboardingItem], dict[str, Any]]:
    existing = await get_packet_for_user(db, company_id, str(user.id))
    if existing:
        items = await load_packet_items(db, existing.id)
        progress = _apply_progress_to_packet(existing, items)
        return existing, items, progress

    template = await ensure_default_template(db, company_id)
    hr = await _hr_for_user(db, str(user.id))
    specs = _items_for_hire(template, plant_role=_hire_is_plant(hr))
    packet = PulseHireOnboardingPacket(
        id=str(uuid4()),
        company_id=company_id,
        user_id=str(user.id),
        template_id=str(template.id),
        status=PACKET_OPEN,
    )
    db.add(packet)
    await db.flush()

    items: list[PulseHireOnboardingItem] = []
    for index, spec in enumerate(specs):
        row = PulseHireOnboardingItem(
            id=str(uuid4()),
            company_id=company_id,
            packet_id=packet.id,
            template_item_id=str(spec.get("id") or "") or None,
            sort_order=index,
            item_key=str(spec["key"]),
            title=str(spec["title"]),
            description=spec.get("description"),
            kind=spec["kind"],
            body_text=spec.get("body_text"),
            is_required=bool(spec.get("is_required", True)),
            status=STATUS_PENDING,
        )
        db.add(row)
        items.append(row)
    await db.flush()
    progress = _apply_progress_to_packet(packet, items)
    return packet, items, progress


async def complete_item(
    db: AsyncSession,
    *,
    item: PulseHireOnboardingItem,
    actor: User,
    signature_name: str | None,
    signed_ack: bool,
) -> PulseHireOnboardingItem:
    if item.kind == KIND_SIGN:
        name = (signature_name or "").strip()
        if not signed_ack:
            raise ValueError("Signature acknowledgment is required")
        if not name:
            raise ValueError("Typed name is required to sign")
        item.signed_ack = True
        item.signature_name = name[:255]
    else:
        item.signed_ack = False
        item.signature_name = None
    item.status = STATUS_COMPLETED
    item.completed_at = _now()
    item.completed_by_user_id = str(actor.id)
    item.updated_at = _now()
    await db.flush()
    return item


async def list_packets_with_progress(
    db: AsyncSession,
    *,
    company_id: str,
    status: str | None = None,
) -> list[tuple[PulseHireOnboardingPacket, User, list[PulseHireOnboardingItem], dict[str, Any]]]:
    stmt = (
        select(PulseHireOnboardingPacket, User)
        .join(User, User.id == PulseHireOnboardingPacket.user_id)
        .where(PulseHireOnboardingPacket.company_id == company_id)
        .order_by(PulseHireOnboardingPacket.created_at.desc())
    )
    if status:
        stmt = stmt.where(PulseHireOnboardingPacket.status == status)
    rows = (await db.execute(stmt)).all()
    out: list[tuple[PulseHireOnboardingPacket, User, list[PulseHireOnboardingItem], dict[str, Any]]] = []
    for packet, user in rows:
        items = await load_packet_items(db, packet.id)
        progress = _apply_progress_to_packet(packet, items)
        out.append((packet, user, items, progress))
    return out


def incomplete_titles(items: Iterable[PulseHireOnboardingItem], *, limit: int = 6) -> list[str]:
    titles: list[str] = []
    for item in items:
        if item.is_required and item.status != STATUS_COMPLETED:
            titles.append(item.title)
        if len(titles) >= limit:
            break
    return titles


async def incomplete_summary(
    db: AsyncSession, *, company_id: str
) -> dict[str, Any]:
    rows = await list_packets_with_progress(db, company_id=company_id, status=PACKET_OPEN)
    hires: list[dict[str, Any]] = []
    incomplete_required = 0
    for packet, user, items, progress in rows:
        remaining = max(0, int(progress["required_total"]) - int(progress["required_completed"]))
        if remaining <= 0:
            continue
        incomplete_required += remaining
        hires.append(
            {
                "packet_id": packet.id,
                "user_id": str(user.id),
                "full_name": user.full_name,
                "email": user.email,
                "required_total": progress["required_total"],
                "required_completed": progress["required_completed"],
                "percent": progress["percent"],
                "incomplete_titles": incomplete_titles(items),
            }
        )
    return {
        "open_hires": len(hires),
        "incomplete_required_items": incomplete_required,
        "hires": hires,
    }
