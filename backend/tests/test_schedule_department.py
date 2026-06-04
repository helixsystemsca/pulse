"""Unit tests for schedule department slug helpers."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.schedule_department import (
    coerce_schedule_department_slug,
    normalize_schedule_department_slug,
    primary_department_slug_from_hr,
    resolve_schedule_department_slug,
)
from app.core.tenant_departments import create_tenant_department
from app.models.pulse_models import PulseWorkerHR


def test_coerce_schedule_department_slug_without_tenant_list() -> None:
    assert coerce_schedule_department_slug("Communications", allowed=None) == "communications"
    assert coerce_schedule_department_slug("plant", allowed=None) == "plant"
    assert coerce_schedule_department_slug("invalid slug!", allowed=None) is None


def test_coerce_schedule_department_slug_with_tenant_list() -> None:
    allowed = frozenset({"plant", "maintenance"})
    assert coerce_schedule_department_slug("plant", allowed=allowed) == "plant"
    assert coerce_schedule_department_slug("communications", allowed=allowed) is None


def test_primary_department_slug_from_hr() -> None:
    hr = PulseWorkerHR(user_id="u1", company_id="c1", department_slugs=["communications"])
    assert primary_department_slug_from_hr(hr, allowed=None) == "communications"
    hr_plant = PulseWorkerHR(user_id="u2", company_id="c1", department="plant")
    assert primary_department_slug_from_hr(hr_plant, allowed=frozenset({"plant"})) == "plant"
    assert primary_department_slug_from_hr(hr_plant, allowed=frozenset({"maintenance"})) is None
    assert primary_department_slug_from_hr(None) is None


@pytest.mark.asyncio
async def test_resolve_schedule_department_slug_tenant_plant(db_session: AsyncSession, seeded_tenant) -> None:
    await create_tenant_department(db_session, seeded_tenant.company_id, name="Plant", slug="plant")
    hr = PulseWorkerHR(
        user_id=seeded_tenant.worker_id,
        company_id=seeded_tenant.company_id,
        department="plant",
    )
    db_session.add(hr)
    await db_session.flush()

    slug = await resolve_schedule_department_slug(
        db_session,
        seeded_tenant.company_id,
        hr=hr,
    )
    assert slug == "plant"

    norm = await normalize_schedule_department_slug(db_session, seeded_tenant.company_id, "plant")
    assert norm == "plant"
