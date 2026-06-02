"""Inventory scanner kiosk API."""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app.core.auth.security import create_access_token, hash_password
from app.core.features.service import sync_enabled_features
from app.models.domain import InventoryItem, User, UserRole
from app.repositories.inventory_scope_repository import ensure_scope_for_company_slug


@pytest.mark.asyncio
async def test_inventory_scanner_receive_and_issue(client, db_session, seeded_tenant) -> None:
    cid = seeded_tenant.company_id
    await sync_enabled_features(db_session, cid, ["inventory", "inventory_scanner"])

    scanner_id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    scanner = User(
        id=scanner_id,
        company_id=cid,
        email="scanner-test@example.com",
        hashed_password=hash_password("pytest-pass-12345"),
        full_name="Scanner Test",
        roles=[UserRole.worker.value],
        is_active=True,
        feature_allow_extra=["inventory_scanner"],
        rbac_permission_extra=["inventory.scan"],
    )
    db_session.add(scanner)
    scope = await ensure_scope_for_company_slug(db_session, cid, "maintenance")
    item = InventoryItem(
        id="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        company_id=cid,
        scope_id=scope.id,
        sku="SCAN-TEST-001",
        name="Scanner Test Part",
        item_type="part",
        category="Test",
        quantity=10,
        unit="each",
        low_stock_threshold=2,
        inv_status="in_stock",
        department_slug="maintenance",
    )
    db_session.add(item)
    await db_session.commit()

    token = create_access_token(
        subject=scanner_id,
        extra_claims={"company_id": cid, "role": UserRole.worker.value, "tv": 0},
    )
    headers = {"Authorization": f"Bearer {token}"}

    lookup = await client.get("/api/inventory/scan/by-sku/SCAN-TEST-001", headers=headers)
    assert lookup.status_code == 200
    assert lookup.json()["sku"] == "SCAN-TEST-001"

    recv = await client.post(
        "/api/inventory/scan/transaction",
        headers={**headers, "Content-Type": "application/json"},
        json={"sku": "SCAN-TEST-001", "action": "receive", "quantity": 5},
    )
    assert recv.status_code == 200
    body = recv.json()
    assert body["quantity_after"] == 15
    assert body["action"] == "receive"

    issue = await client.post(
        "/api/inventory/scan/transaction",
        headers={**headers, "Content-Type": "application/json"},
        json={"sku": "SCAN-TEST-001", "action": "issue", "quantity": 3},
    )
    assert issue.status_code == 200
    assert issue.json()["quantity_after"] == 12

    row = (
        await db_session.execute(select(InventoryItem).where(InventoryItem.id == item.id))
    ).scalar_one()
    assert float(row.quantity) == 12


@pytest.mark.asyncio
async def test_inventory_transaction_settings_and_batch(client, db_session, seeded_tenant) -> None:
    cid = seeded_tenant.company_id
    await sync_enabled_features(db_session, cid, ["inventory", "inventory_scanner"])

    scanner_id = "cccccccc-cccc-cccc-cccc-cccccccccccc"
    scanner = User(
        id=scanner_id,
        company_id=cid,
        email="scanner-batch@example.com",
        hashed_password=hash_password("pytest-pass-12345"),
        full_name="Scanner Batch",
        roles=[UserRole.worker.value],
        is_active=True,
        feature_allow_extra=["inventory_scanner"],
        rbac_permission_extra=["inventory.scan"],
    )
    db_session.add(scanner)
    scope = await ensure_scope_for_company_slug(db_session, cid, "maintenance")
    item_a = InventoryItem(
        id="dddddddd-dddd-dddd-dddd-dddddddddddd",
        company_id=cid,
        scope_id=scope.id,
        sku="BATCH-A",
        name="Batch Item A",
        item_type="part",
        category="Test",
        quantity=10,
        unit="each",
        low_stock_threshold=2,
        inv_status="in_stock",
        department_slug="maintenance",
    )
    item_b = InventoryItem(
        id="eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
        company_id=cid,
        scope_id=scope.id,
        sku="BATCH-B",
        name="Batch Item B",
        item_type="part",
        category="Test",
        quantity=5,
        unit="each",
        low_stock_threshold=2,
        inv_status="in_stock",
        department_slug="maintenance",
    )
    db_session.add_all([item_a, item_b])
    await db_session.commit()

    token = create_access_token(
        subject=scanner_id,
        extra_claims={"company_id": cid, "role": UserRole.worker.value, "tv": 0},
    )
    headers = {"Authorization": f"Bearer {token}"}

    settings = await client.get("/api/inventory/scan/transaction-settings", headers=headers)
    assert settings.status_code == 200
    body = settings.json()
    assert body["enable_batch_transactions"] is True
    assert body["enable_references"] is False

    batch = await client.post(
        "/api/inventory/scan/transactions",
        headers={**headers, "Content-Type": "application/json"},
        json={
            "transaction_type": "issue",
            "lines": [
                {"item_id": item_a.id, "quantity": 2},
                {"item_id": item_b.id, "quantity": 1},
            ],
        },
    )
    assert batch.status_code == 200
    out = batch.json()
    assert out["transaction_type"] == "issue"
    assert len(out["lines"]) == 2

    row_a = (await db_session.execute(select(InventoryItem).where(InventoryItem.id == item_a.id))).scalar_one()
    row_b = (await db_session.execute(select(InventoryItem).where(InventoryItem.id == item_b.id))).scalar_one()
    assert float(row_a.quantity) == 8
    assert float(row_b.quantity) == 4
