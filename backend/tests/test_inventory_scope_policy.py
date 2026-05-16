"""Inventory scope helpers (repository + migration coexistence)."""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app.models.domain import DepartmentInventoryScope, InventoryScope
from app.repositories.inventory_scope_repository import ensure_scope_for_company_slug


@pytest.mark.asyncio
async def test_ensure_scope_for_company_slug_creates_mapping(db_session, seeded_tenant) -> None:
    cid = seeded_tenant.company_id
    scope = await ensure_scope_for_company_slug(db_session, cid, "communications")
    await db_session.flush()

    assert scope.slug == "communications"
    q = await db_session.execute(
        select(DepartmentInventoryScope).where(
            DepartmentInventoryScope.company_id == cid,
            DepartmentInventoryScope.scope_id == scope.id,
        )
    )
    assert q.scalar_one_or_none() is not None

    row = await db_session.get(InventoryScope, scope.id)
    assert row is not None
    assert row.company_id == cid


@pytest.mark.asyncio
async def test_repository_denies_write_when_scope_not_in_writable_set() -> None:
    from types import SimpleNamespace

    from app.core.inventory.policy import EffectiveInventoryPolicy
    from app.repositories.inventory_scope_repository import can_write_inventory_item

    policy = EffectiveInventoryPolicy({"a"}, {"b"}, {"b"}, False)
    item = SimpleNamespace(scope_id="a")
    assert can_write_inventory_item(policy, item) is False


@pytest.mark.asyncio
async def test_repository_company_admin_can_write_any_scope() -> None:
    from types import SimpleNamespace

    from app.core.inventory.policy import EffectiveInventoryPolicy
    from app.repositories.inventory_scope_repository import can_write_inventory_item

    policy = EffectiveInventoryPolicy(set(), set(), set(), True)
    item = SimpleNamespace(scope_id="any")
    assert can_write_inventory_item(policy, item) is True
