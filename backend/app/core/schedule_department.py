"""Department scoping for workforce schedule — tenant-configured slugs (not Panorama-only)."""

from __future__ import annotations

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tenant_departments import normalize_department_slug_format, tenant_department_slug_set
from app.models.pulse_models import PulseScheduleShift, PulseWorkerHR

# Legacy Panorama schedule slugs (reference only — not used as silent defaults).
LEGACY_SCHEDULE_DEPARTMENT_SLUGS: frozenset[str] = frozenset(
    {"maintenance", "communications", "reception", "aquatics", "fitness", "admin", "racquets"}
)

# Deprecated alias — do not use as a fallback for unresolved departments.
DEFAULT_SCHEDULE_DEPARTMENT_SLUG = "maintenance"


async def schedule_allowed_department_slugs(db: AsyncSession, company_id: str) -> frozenset[str] | None:
    """Configured tenant departments, or ``None`` when the org has not defined any yet."""
    allowed = await tenant_department_slug_set(db, company_id)
    return allowed if allowed else None


def coerce_schedule_department_slug(
    raw: str | None,
    *,
    allowed: frozenset[str] | None,
) -> str | None:
    """Normalize slug syntax; when ``allowed`` is set, require membership in tenant departments."""
    slug = normalize_department_slug_format(raw)
    if not slug:
        return None
    if allowed is not None:
        return slug if slug in allowed else None
    return slug


async def normalize_schedule_department_slug(
    db: AsyncSession,
    company_id: str,
    raw: str | None,
) -> str | None:
    allowed = await schedule_allowed_department_slugs(db, company_id)
    return coerce_schedule_department_slug(raw, allowed=allowed)


def primary_department_slug_from_hr(
    hr: PulseWorkerHR | None,
    *,
    allowed: frozenset[str] | None = None,
) -> str | None:
    if hr is None:
        return None
    slugs = hr.department_slugs
    if isinstance(slugs, list):
        for raw in slugs:
            hit = coerce_schedule_department_slug(str(raw), allowed=allowed)
            if hit:
                return hit
    return coerce_schedule_department_slug(hr.department, allowed=allowed)


async def primary_department_slug_from_hr_for_company(
    db: AsyncSession,
    company_id: str,
    hr: PulseWorkerHR | None,
) -> str | None:
    allowed = await schedule_allowed_department_slugs(db, company_id)
    return primary_department_slug_from_hr(hr, allowed=allowed)


async def load_hr_by_user_ids(
    db: AsyncSession,
    company_id: str,
    user_ids: list[str],
) -> dict[str, PulseWorkerHR]:
    if not user_ids:
        return {}
    rows = (
        await db.execute(
            select(PulseWorkerHR).where(
                PulseWorkerHR.company_id == company_id,
                PulseWorkerHR.user_id.in_(user_ids),
            )
        )
    ).scalars().all()
    return {str(r.user_id): r for r in rows}


async def user_ids_for_department(
    db: AsyncSession,
    company_id: str,
    department_slug: str,
) -> set[str]:
    slug = await normalize_schedule_department_slug(db, company_id, department_slug)
    if not slug:
        return set()
    allowed = await schedule_allowed_department_slugs(db, company_id)
    rows = (
        await db.execute(select(PulseWorkerHR).where(PulseWorkerHR.company_id == company_id))
    ).scalars().all()
    out: set[str] = set()
    for hr in rows:
        if primary_department_slug_from_hr(hr, allowed=allowed) == slug:
            out.add(str(hr.user_id))
    return out


async def resolve_schedule_department_slug(
    db: AsyncSession,
    company_id: str,
    *,
    explicit: str | None = None,
    hr: PulseWorkerHR | None = None,
    user_id: str | None = None,
) -> str | None:
    """Resolve a schedule/project department slug without defaulting to Panorama maintenance."""
    if explicit is not None and str(explicit).strip():
        return await normalize_schedule_department_slug(db, company_id, explicit)
    if hr is None and user_id:
        hr = await db.get(PulseWorkerHR, user_id)
        if hr and str(hr.company_id) != company_id:
            hr = None
    if hr is not None:
        return await primary_department_slug_from_hr_for_company(db, company_id, hr)
    return None


async def resolve_department_slug_for_user(
    db: AsyncSession,
    company_id: str,
    user_id: str,
    explicit: str | None = None,
) -> str | None:
    hr = await db.get(PulseWorkerHR, user_id)
    if hr and str(hr.company_id) != company_id:
        hr = None
    return await resolve_schedule_department_slug(
        db,
        company_id,
        explicit=explicit,
        hr=hr,
    )


def apply_shift_department_filter(stmt: Select, department_slug: str | None) -> Select:
    slug = normalize_department_slug_format(department_slug)
    if not slug:
        return stmt
    return stmt.where(PulseScheduleShift.department_slug == slug)
