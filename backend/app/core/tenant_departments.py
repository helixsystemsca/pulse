"""Tenant-scoped workspace departments (inventory partitions, HR tags, roles)."""

from __future__ import annotations

import re
from typing import Sequence
from uuid import uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import InventoryItem, User
from app.models.pulse_models import PulseWorkerHR
from app.models.rbac_models import TenantDepartment, TenantRole

_SLUG_RE = re.compile(r"^[a-z][a-z0-9_-]{0,63}$")

DEFAULT_TENANT_DEPARTMENTS: list[tuple[str, str]] = [
    ("maintenance", "Maintenance"),
    ("communications", "Communications"),
    ("reception", "Reception"),
    ("aquatics", "Aquatics"),
    ("fitness", "Fitness"),
    ("racquets", "Racquets"),
    ("admin", "Administration"),
]


def normalize_department_slug_format(raw: str | None) -> str | None:
    """Lowercase slug syntax check only (not tenant membership)."""
    if raw is None:
        return None
    s = str(raw).strip().lower().replace(" ", "-")
    s = re.sub(r"-+", "-", s).strip("-")
    if not s or not _SLUG_RE.match(s):
        return None
    return s


def slug_from_department_name(name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.strip().lower()).strip("-")
    if not base or not _SLUG_RE.match(base):
        base = "department"
    return base[:64]


async def list_tenant_departments(db: AsyncSession, company_id: str) -> list[TenantDepartment]:
    q = await db.execute(
        select(TenantDepartment)
        .where(TenantDepartment.company_id == company_id)
        .order_by(TenantDepartment.name)
    )
    return list(q.scalars().all())


async def tenant_department_slug_set(db: AsyncSession, company_id: str) -> frozenset[str]:
    rows = await list_tenant_departments(db, company_id)
    return frozenset(r.slug for r in rows)


async def get_tenant_department_by_id(
    db: AsyncSession, company_id: str, department_id: str
) -> TenantDepartment | None:
    row = await db.get(TenantDepartment, department_id)
    if not row or str(row.company_id) != company_id:
        return None
    return row


async def ensure_default_tenant_departments(db: AsyncSession, company_id: str) -> None:
    existing = await tenant_department_slug_set(db, company_id)
    for slug, name in DEFAULT_TENANT_DEPARTMENTS:
        if slug in existing:
            continue
        db.add(
            TenantDepartment(
                id=str(uuid4()),
                company_id=company_id,
                slug=slug,
                name=name,
            )
        )
    await db.flush()


async def validate_tenant_department_slug(db: AsyncSession, company_id: str, raw: str) -> str:
    slug = normalize_department_slug_format(raw)
    if not slug:
        raise ValueError(f"Invalid department slug: {raw!r}")
    allowed = await tenant_department_slug_set(db, company_id)
    if not allowed:
        return slug
    if slug not in allowed:
        raise ValueError(f"Unknown department slug (not configured for this organization): {slug}")
    return slug


async def normalize_procedure_department_category_for_company(
    db: AsyncSession,
    company_id: str,
    raw: object | None,
) -> str | None:
    """Procedure ``department_category`` — tenant slug when configured, else any valid slug format."""
    if raw is None:
        return None
    if not str(raw).strip():
        return None
    try:
        return await validate_tenant_department_slug(db, company_id, str(raw))
    except ValueError:
        return None


async def create_tenant_department(
    db: AsyncSession,
    company_id: str,
    *,
    name: str,
    slug: str | None = None,
) -> TenantDepartment:
    clean_name = name.strip()
    if not clean_name:
        raise ValueError("Department name is required")
    final_slug = normalize_department_slug_format(slug) if slug else slug_from_department_name(clean_name)
    if not final_slug:
        raise ValueError("Could not derive a valid department slug")
    existing = await db.execute(
        select(TenantDepartment.id).where(
            TenantDepartment.company_id == company_id,
            TenantDepartment.slug == final_slug,
        )
    )
    if existing.scalar_one_or_none():
        raise ValueError("A department with this slug already exists")
    row = TenantDepartment(
        id=str(uuid4()),
        company_id=company_id,
        slug=final_slug,
        name=clean_name,
    )
    db.add(row)
    await db.flush()
    return row


async def patch_tenant_department(
    db: AsyncSession,
    company_id: str,
    department_id: str,
    *,
    name: str | None = None,
) -> TenantDepartment:
    row = await get_tenant_department_by_id(db, company_id, department_id)
    if not row:
        raise LookupError("Department not found")
    if name is not None:
        clean = name.strip()
        if not clean:
            raise ValueError("Department name is required")
        row.name = clean
    await db.flush()
    return row


async def _department_usage_counts(db: AsyncSession, company_id: str, slug: str, department_id: str) -> dict[str, int]:
    inv_q = await db.execute(
        select(func.count())
        .select_from(InventoryItem)
        .where(InventoryItem.company_id == company_id, InventoryItem.department_slug == slug)
    )
    inv_count = int(inv_q.scalar_one() or 0)

    roles_q = await db.execute(
        select(func.count()).select_from(TenantRole).where(
            TenantRole.company_id == company_id,
            TenantRole.department_id == department_id,
        )
    )
    roles_count = int(roles_q.scalar_one() or 0)

    hr_q = await db.execute(
        select(func.count())
        .select_from(PulseWorkerHR)
        .join(User, User.id == PulseWorkerHR.user_id)
        .where(
            User.company_id == company_id,
            or_(
                PulseWorkerHR.department == slug,
                PulseWorkerHR.department_slugs.contains([slug]),
            ),
        )
    )
    hr_count = int(hr_q.scalar_one() or 0)
    return {"inventory_items": inv_count, "tenant_roles": roles_count, "workers": hr_count}


async def delete_tenant_department(db: AsyncSession, company_id: str, department_id: str) -> None:
    row = await get_tenant_department_by_id(db, company_id, department_id)
    if not row:
        raise LookupError("Department not found")
    usage = await _department_usage_counts(db, company_id, row.slug, row.id)
    if usage["inventory_items"] or usage["tenant_roles"] or usage["workers"]:
        parts = []
        if usage["inventory_items"]:
            parts.append(f"{usage['inventory_items']} inventory item(s)")
        if usage["workers"]:
            parts.append(f"{usage['workers']} worker profile(s)")
        if usage["tenant_roles"]:
            parts.append(f"{usage['tenant_roles']} access overlay(s)")
        raise ValueError(f"Department is in use ({', '.join(parts)}). Reassign or remove references first.")
    await db.delete(row)
    await db.flush()


def normalize_department_slug_list(values: Sequence[str] | None) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for x in values or []:
        n = normalize_department_slug_format(str(x))
        if n and n not in seen:
            seen.add(n)
            out.append(n)
    return out
