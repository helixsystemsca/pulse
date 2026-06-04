"""Procedure department_category uses tenant-configured slugs."""

from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tenant_departments import (
    create_tenant_department,
    normalize_procedure_department_category_for_company,
)


@pytest.mark.asyncio
async def test_procedure_department_category_accepts_tenant_plant(db_session: AsyncSession, seeded_tenant) -> None:
    await create_tenant_department(db_session, seeded_tenant.company_id, name="Plant", slug="plant")
    norm = await normalize_procedure_department_category_for_company(
        db_session, seeded_tenant.company_id, "plant"
    )
    assert norm == "plant"


@pytest.mark.asyncio
async def test_procedure_department_category_rejects_unknown_when_tenant_configured(
    db_session: AsyncSession, seeded_tenant
) -> None:
    await create_tenant_department(db_session, seeded_tenant.company_id, name="Plant", slug="plant")
    norm = await normalize_procedure_department_category_for_company(
        db_session, seeded_tenant.company_id, "communications"
    )
    assert norm is None
