"""Financial & Asset Planning HTTP: formula, PO→invoice, forecasts, permissions."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth.security import create_access_token
from app.core.features.cache import clear_all
from app.models.domain import FacilityEquipment, FacilityEquipmentStatus, User, UserRole
from app.models.pm_models import PmTask
from tests.tenant_role_helpers import assign_worker_no_access_role


async def _admin_token(db_session: AsyncSession, seeded_tenant) -> str:
    from app.core.company_features import sync_enabled_features
    from app.core.features.system_catalog import GLOBAL_SYSTEM_FEATURES

    await sync_enabled_features(db_session, seeded_tenant.company_id, list(GLOBAL_SYSTEM_FEATURES))
    admin = await db_session.get(User, seeded_tenant.manager_id)
    assert admin is not None
    admin.roles = [UserRole.company_admin.value]
    await db_session.flush()
    clear_all()
    return create_access_token(
        subject=admin.id,
        extra_claims={
            "company_id": seeded_tenant.company_id,
            "role": UserRole.company_admin.value,
            "tv": 0,
        },
    )


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


async def _approve_operating(client: AsyncClient, headers: dict[str, str], amount: float) -> str:
    variance = await client.get("/api/v1/finance/operating/variance", headers=headers)
    assert variance.status_code == 200, variance.text
    lines = variance.json()["lines"]
    assert lines, "ensure_defaults should seed operating lines"
    line_id = lines[0]["id"]
    patched = await client.patch(
        f"/api/v1/finance/budget-lines/{line_id}",
        headers=headers,
        json={"approved_amount": amount},
    )
    assert patched.status_code == 200, patched.text
    return line_id


@pytest.mark.asyncio
async def test_dashboard_available_formula_example(
    client: AsyncClient, db_session: AsyncSession, seeded_tenant
) -> None:
    token = await _admin_token(db_session, seeded_tenant)
    headers = _headers(token)
    await _approve_operating(client, headers, 125000)

    po = await client.post(
        "/api/v1/finance/purchase-orders",
        headers=headers,
        json={"vendor_name": "Ice plant contractor", "amount": 32000, "status": "issued"},
    )
    assert po.status_code == 200, po.text
    assert po.json()["remaining_commitment"] == 32000.0
    assert po.json()["status"] == "issued"

    inv = await client.post(
        "/api/v1/finance/invoices",
        headers=headers,
        json={"vendor_name": "Chemicals Co", "amount": 47250, "status": "posted"},
    )
    assert inv.status_code == 200, inv.text

    dash = await client.get("/api/v1/finance/dashboard", headers=headers)
    assert dash.status_code == 200, dash.text
    combined = dash.json()["combined"]
    assert combined["approved"] == 125000.0
    assert combined["actual"] == 47250.0
    assert combined["committed"] == 32000.0
    assert combined["available"] == 45750.0
    why = " ".join(e["why"] for e in combined["explanations"] if e["label"] == "Available")
    assert "125000.00" in why and "47250.00" in why and "32000.00" in why
    assert combined["available"] != combined["approved"] - combined["actual"]


@pytest.mark.asyncio
async def test_po_invoice_never_double_counts(
    client: AsyncClient, db_session: AsyncSession, seeded_tenant
) -> None:
    token = await _admin_token(db_session, seeded_tenant)
    headers = _headers(token)
    await _approve_operating(client, headers, 125000)

    po = await client.post(
        "/api/v1/finance/purchase-orders",
        headers=headers,
        json={"amount": 32000, "status": "issued", "vendor_name": "HVAC"},
    )
    po_id = po.json()["id"]
    inv = await client.post(
        "/api/v1/finance/invoices",
        headers=headers,
        json={"amount": 10000, "status": "posted", "po_id": po_id},
    )
    assert inv.status_code == 200, inv.text

    listed = await client.get("/api/v1/finance/purchase-orders", headers=headers)
    row = next(p for p in listed.json()["items"] if p["id"] == po_id)
    assert row["remaining_commitment"] == 22000.0
    assert row["status"] == "partial"

    dash = await client.get("/api/v1/finance/dashboard", headers=headers)
    combined = dash.json()["combined"]
    assert combined["actual"] == 10000.0
    assert combined["committed"] == 22000.0
    assert combined["available"] == 93000.0


@pytest.mark.asyncio
async def test_funding_crud_and_history_keeps_original(
    client: AsyncClient, db_session: AsyncSession, seeded_tenant
) -> None:
    token = await _admin_token(db_session, seeded_tenant)
    headers = _headers(token)
    created = await client.post(
        "/api/v1/finance/funding-sources",
        headers=headers,
        json={"name": "Canada Community-Building Fund", "kind": "grant", "amount_available": 50000},
    )
    assert created.status_code == 200, created.text
    listed = await client.get("/api/v1/finance/funding-sources", headers=headers)
    names = [row["name"] for row in listed.json()["items"]]
    assert "Canada Community-Building Fund" in names
    assert "Taxation" in names

    await _approve_operating(client, headers, 1000)
    hist = await client.get("/api/v1/finance/history", headers=headers)
    assert hist.status_code == 200, hist.text
    kinds = {row["version_kind"] for row in hist.json()["items"]}
    assert "ORIGINAL" in kinds
    assert "REVISED" in kinds


@pytest.mark.asyncio
async def test_replacement_and_pm_forecast_feed(
    client: AsyncClient, db_session: AsyncSession, seeded_tenant
) -> None:
    token = await _admin_token(db_session, seeded_tenant)
    headers = _headers(token)
    eq = FacilityEquipment(
        id=str(uuid4()),
        company_id=seeded_tenant.company_id,
        name="Civic Arena ice plant",
        type="Refrigeration",
        status=FacilityEquipmentStatus.active,
        installation_date=datetime(2016, 9, 16).date(),
    )
    db_session.add(eq)
    db_session.add(
        PmTask(
            id=str(uuid4()),
            company_id=seeded_tenant.company_id,
            equipment_id=eq.id,
            name="Compressor oil sample",
            frequency_type="months",
            frequency_value=1,
            next_due_at=datetime.now(timezone.utc) + timedelta(days=20),
            estimated_cost=Decimal("500.00"),
        )
    )
    await db_session.flush()

    profile = await client.post(
        "/api/v1/finance/asset-profiles",
        headers=headers,
        json={
            "equipment_id": eq.id,
            "useful_life_years": 15,
            "acquisition_cost": 80000,
            "replacement_value": 120000,
            "acquisition_date": "2016-09-16",
            "condition": "fair",
            "criticality": "high",
        },
    )
    assert profile.status_code == 200, profile.text
    body = profile.json()
    assert body["age_years"] >= 9
    assert any(f["label"] == "Condition" for f in body["factors"])
    assert all("score" not in f["label"].lower() for f in body["factors"])

    repl = await client.get("/api/v1/finance/lifecycle/replacement", headers=headers)
    assert repl.status_code == 200, repl.text
    names = [i["name"] for i in repl.json()["items"]]
    assert "Civic Arena ice plant" in names

    svc = await client.get("/api/v1/finance/lifecycle/service", headers=headers)
    assert svc.status_code == 200, svc.text
    d30 = svc.json()["windows"]["d30"]
    assert any(row["service"] == "Compressor oil sample" and row["cost"] == 500.0 for row in d30)


@pytest.mark.asyncio
async def test_next_year_builder_and_scenarios_are_sourced(
    client: AsyncClient, db_session: AsyncSession, seeded_tenant
) -> None:
    token = await _admin_token(db_session, seeded_tenant)
    headers = _headers(token)
    nxt = await client.get("/api/v1/finance/planner/next-year", headers=headers)
    assert nxt.status_code == 200, nxt.text
    payload = nxt.json()
    assert payload["candidates"]
    assert all("why" in c and "origin" in c for c in payload["candidates"])
    assert payload["ai_guard"]["allowed"] is False

    sc = await client.post(
        "/api/v1/finance/scenarios",
        headers=headers,
        json={"name": "Ice plant end of life"},
    )
    opt = await client.post(
        "/api/v1/finance/scenario-options",
        headers=headers,
        json={
            "scenario_id": sc.json()["id"],
            "option_kind": "replace_next_year",
            "estimated_cost": 100000,
            "risk_note": "Failure would cancel public skate",
        },
    )
    assert opt.status_code == 200, opt.text
    cons = opt.json()["consequences"]
    assert cons["decision"] is None

    compare = await client.get("/api/v1/finance/scenarios/compare", headers=headers)
    assert compare.status_code == 200, compare.text
    assert compare.json()["rows"]

    opp = await client.get("/api/v1/finance/opportunities", headers=headers)
    assert opp.status_code == 200, opp.text
    titles = [r["title"] for r in opp.json()["recommendations"]]
    assert "No spend recommended" in titles
    assert opp.json()["ai_guard"]["allowed"] is False

    ask = await client.post(
        "/api/v1/finance/assistant/ask",
        headers=headers,
        json={"query": "Why is available not approved minus actual?"},
    )
    assert ask.status_code == 200, ask.text
    assert "Approved" in ask.json()["answer"]
    assert "cannot purchase" in ask.json()["disclaimer"].lower()


@pytest.mark.asyncio
async def test_capital_project_budget_position_and_csv(
    client: AsyncClient, db_session: AsyncSession, seeded_tenant
) -> None:
    token = await _admin_token(db_session, seeded_tenant)
    headers = _headers(token)
    item = await client.post(
        "/api/v1/finance/capital-items",
        headers=headers,
        json={
            "name": "Replace Zamboni",
            "kind": "project",
            "estimated_cost": 180000,
            "approved_amount": 150000,
            "start_year": 2026,
            "end_year": 2027,
            "priority": "high",
            "justification": "End of useful life; parts no longer stocked.",
        },
    )
    assert item.status_code == 200, item.text
    cap_id = item.json()["id"]
    await client.post(
        "/api/v1/finance/purchase-orders",
        headers=headers,
        json={"amount": 40000, "status": "issued", "capital_item_id": cap_id, "vendor_name": "Resurfacer Ltd"},
    )
    cap = await client.get("/api/v1/finance/capital/projects", headers=headers)
    assert cap.status_code == 200, cap.text
    row = next(i for i in cap.json()["items"] if i["id"] == cap_id)
    assert row["position"]["approved"] == 150000.0
    assert row["position"]["committed"] == 40000.0
    assert row["position"]["available"] == 110000.0

    csv = await client.get("/api/v1/finance/reports.csv", headers=headers)
    assert csv.status_code == 200, csv.text
    assert "available" in csv.text.lower()

    long_range = await client.get("/api/v1/finance/planner/long-range", headers=headers)
    assert long_range.status_code == 200, long_range.text
    assert long_range.json()["peak_year"]


@pytest.mark.asyncio
async def test_finance_denied_without_rbac(
    client: AsyncClient, db_session: AsyncSession, seeded_tenant
) -> None:
    from app.core.company_features import sync_enabled_features
    from app.core.features.system_catalog import GLOBAL_SYSTEM_FEATURES

    await sync_enabled_features(db_session, seeded_tenant.company_id, list(GLOBAL_SYSTEM_FEATURES))
    worker = await db_session.get(User, seeded_tenant.worker_id)
    assert worker is not None
    await assign_worker_no_access_role(
        db_session,
        company_id=seeded_tenant.company_id,
        user=worker,
        contract_names=list(GLOBAL_SYSTEM_FEATURES),
    )
    await db_session.flush()
    r = await client.get(
        "/api/v1/finance/dashboard",
        headers={"Authorization": f"Bearer {seeded_tenant.worker_token}"},
    )
    assert r.status_code == 403, r.text
