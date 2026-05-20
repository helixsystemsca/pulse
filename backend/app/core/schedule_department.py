"""Department scoping for workforce schedule (mirrors inventory department_slug pattern)."""

from __future__ import annotations

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pulse_models import PulseScheduleShift, PulseWorkerHR

SCHEDULE_DEPARTMENT_SLUGS: frozenset[str] = frozenset(
    {"maintenance", "communications", "reception", "aquatics", "fitness", "admin", "racquets"}
)

DEFAULT_SCHEDULE_DEPARTMENT_SLUG = "maintenance"


def normalize_schedule_department_slug(raw: str | None) -> str | None:
    if raw is None:
        return None
    slug = str(raw).strip().lower()
    if not slug or slug not in SCHEDULE_DEPARTMENT_SLUGS:
        return None
    return slug


def primary_department_slug_from_hr(hr: PulseWorkerHR | None) -> str | None:
    if hr is None:
        return None
    slugs = hr.department_slugs
    if isinstance(slugs, list) and slugs:
        first = normalize_schedule_department_slug(str(slugs[0]))
        if first:
            return first
    dept = (hr.department or "").strip().lower()
    if dept in SCHEDULE_DEPARTMENT_SLUGS:
        return dept
    return None


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
    slug = normalize_schedule_department_slug(department_slug)
    if not slug:
        return set()
    rows = (
        await db.execute(select(PulseWorkerHR).where(PulseWorkerHR.company_id == company_id))
    ).scalars().all()
    out: set[str] = set()
    for hr in rows:
        if primary_department_slug_from_hr(hr) == slug:
            out.add(str(hr.user_id))
    return out


async def resolve_department_slug_for_user(
    db: AsyncSession,
    company_id: str,
    user_id: str,
    explicit: str | None = None,
) -> str:
    norm = normalize_schedule_department_slug(explicit)
    if norm:
        return norm
    hr = await db.get(PulseWorkerHR, user_id)
    if hr and str(hr.company_id) == company_id:
        from_hr = primary_department_slug_from_hr(hr)
        if from_hr:
            return from_hr
    return DEFAULT_SCHEDULE_DEPARTMENT_SLUG


def apply_shift_department_filter(stmt: Select, department_slug: str | None) -> Select:
    slug = normalize_schedule_department_slug(department_slug)
    if not slug:
        return stmt
    return stmt.where(PulseScheduleShift.department_slug == slug)
