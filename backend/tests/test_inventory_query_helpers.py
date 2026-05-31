"""Inventory query batching helpers."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

import pytest

from app.api.inventory_query_helpers import last_used_at_map
from app.models.domain import InventoryItem, InventoryMovement, InventoryUsage
from app.repositories.inventory_scope_repository import ensure_scope_for_company_slug


@pytest.mark.asyncio
async def test_last_used_at_map_batches(db_session, seeded_tenant) -> None:
    cid = seeded_tenant.company_id
    scope = await ensure_scope_for_company_slug(db_session, cid, "maintenance")
    i1 = str(uuid4())
    i2 = str(uuid4())
    db_session.add_all(
        [
            InventoryItem(
                id=i1,
                company_id=cid,
                scope_id=scope.id,
                sku="BATCH-1",
                name="One",
                item_type="part",
                category="T",
                quantity=1,
                unit="each",
                low_stock_threshold=0,
                inv_status="in_stock",
                department_slug="maintenance",
            ),
            InventoryItem(
                id=i2,
                company_id=cid,
                scope_id=scope.id,
                sku="BATCH-2",
                name="Two",
                item_type="part",
                category="T",
                quantity=1,
                unit="each",
                low_stock_threshold=0,
                inv_status="in_stock",
                department_slug="maintenance",
            ),
        ]
    )
    t1 = datetime(2025, 1, 1, tzinfo=timezone.utc)
    t2 = datetime(2025, 6, 1, tzinfo=timezone.utc)
    db_session.add(
        InventoryUsage(
            id=str(uuid4()),
            company_id=cid,
            item_id=i1,
            work_request_id=str(uuid4()),
            quantity=1,
            created_at=t1,
        )
    )
    db_session.add(
        InventoryMovement(
            id=str(uuid4()),
            company_id=cid,
            item_id=i2,
            action="used",
            quantity=1,
            created_at=t2,
        )
    )
    await db_session.commit()

    got = await last_used_at_map(db_session, [i1, i2])
    assert got[i1] == t1
    assert got[i2] == t2
