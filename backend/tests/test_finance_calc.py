"""Budget formula and procurement commitment math."""

from datetime import date
from decimal import Decimal

from app.core.finance_calc import (
    apply_posted_invoice,
    apply_contingency,
    asset_lifecycle,
    budget_position,
    cancel_purchase_order,
    inflate,
    issue_purchase_order,
    money,
    recommendation_guard,
    scenario_consequence,
    void_posted_invoice,
    yoy_change,
)


def test_available_is_approved_minus_actual_minus_committed() -> None:
    pos = budget_position(approved=125000, actual=47250, committed=32000, forecast_remaining=20000)
    assert pos.available == Decimal("45750.00")
    assert pos.projected_year_end == Decimal("25750.00")
    assert pos.percent_spent == Decimal("37.80")
    assert pos.percent_committed == Decimal("25.60")
    why = [e.why for e in pos.explanations() if e.label == "Available"][0]
    assert "125000.00 − 47250.00 − 32000.00" in why.replace(" ", " ")


def test_available_is_not_approved_minus_actual_only() -> None:
    pos = budget_position(approved=100, actual=40, committed=25)
    assert pos.available == Decimal("35.00")
    assert pos.available != Decimal("60.00")


def test_po_creates_commitment_invoice_moves_to_actual() -> None:
    po = issue_purchase_order(32000)
    assert po.remaining_commitment == Decimal("32000.00")
    assert po.status == "issued"
    actual, po2 = apply_posted_invoice(po, 10000)
    assert actual == Decimal("10000.00")
    assert po2 is not None
    assert po2.remaining_commitment == Decimal("22000.00")
    assert po2.status == "partial"
    actual2, po3 = apply_posted_invoice(po2, 22000)
    assert actual2 == Decimal("22000.00")
    assert po3 is not None
    assert po3.remaining_commitment == Decimal("0.00")
    assert po3.status == "closed"
    # Same dollars never sit in both remaining commitment and the new actual.
    assert po3.remaining_commitment + actual + actual2 == po.amount


def test_invoice_without_po_is_actual_only() -> None:
    actual, po = apply_posted_invoice(None, 500)
    assert actual == Decimal("500.00")
    assert po is None


def test_void_invoice_restores_commitment() -> None:
    po = issue_purchase_order(1000)
    _, po = apply_posted_invoice(po, 400)
    delta, po2 = void_posted_invoice(po, 400)
    assert delta == Decimal("-400.00")
    assert po2 is not None
    assert po2.remaining_commitment == Decimal("1000.00")
    assert po2.status == "issued"


def test_cancel_po_releases_commitment() -> None:
    po = cancel_purchase_order(issue_purchase_order(5000))
    assert po.remaining_commitment == Decimal("0.00")
    assert po.status == "cancelled"


def test_inflate_and_contingency() -> None:
    assert inflate(100, "0.10", 1) == Decimal("110.00")
    assert inflate(100, "0.10", 0) == Decimal("100.00")
    assert apply_contingency(100, "0.10") == Decimal("110.00")


def test_asset_lifecycle_age_rul_and_factors() -> None:
    calc = asset_lifecycle(
        as_of=date(2026, 9, 16),
        acquisition_date=date(2016, 9, 16),
        installation_date=None,
        useful_life_years=15,
        acquisition_cost=80000,
        replacement_value=120000,
        planned_replacement_year=None,
        planned_replacement_cost=None,
        maintenance_cost_to_date=20000,
        inflation_rate="0.03",
        contingency_rate="0.10",
        condition="fair",
        criticality="high",
    )
    assert calc.age_years == Decimal("10.00")
    assert calc.remaining_useful_life_years == Decimal("5.00")
    assert calc.planned_replacement_year == 2031
    assert calc.lifecycle_cost_to_date == Decimal("100000.00")
    labels = {f["label"] for f in calc.factors}
    assert "Condition" in labels
    assert "Criticality" in labels
    # No unexplained composite score.
    assert all("score" not in f["label"].lower() for f in calc.factors)


def test_scenario_consequences_are_not_decisions() -> None:
    row = scenario_consequence(
        kind="replace_next_year",
        replacement_cost_now=100000,
        repair_cost=15000,
        annual_maintenance=8000,
        inflation_rate="0.03",
        risk_note="Ice plant end of life",
    )
    assert row["decision"] is None
    assert row["estimated_cost"] > 100000
    assert "will not choose" in row["why"].lower()


def test_assistant_cannot_commit_money() -> None:
    assert recommendation_guard("explain")["allowed"] is True
    assert recommendation_guard("issue_po")["allowed"] is False
    assert recommendation_guard("approve")["allowed"] is False


def test_yoy_and_money_quantize() -> None:
    assert money("10.006") == Decimal("10.01")
    yoy = yoy_change(110, 100)
    assert yoy["delta"] == 10.0
    assert yoy["percent"] == 10.0
