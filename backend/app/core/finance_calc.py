"""Municipal recreation budget math — transparent, no hidden scores.

Available = Approved − Actual − Committed (encumbered).
A purchase order creates commitment. A posted invoice reduces remaining
commitment and increases actual — never both at once for the same dollars.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Iterable, Literal, Mapping

TWOPLACES = Decimal("0.01")
ZERO = Decimal("0.00")
ONE = Decimal("1.00")

DataOrigin = Literal["system", "user_input", "forecast", "ai_recommendation"]
BudgetKind = Literal["operating", "capital"]
PoStatus = Literal["draft", "issued", "partial", "closed", "cancelled"]
InvoiceStatus = Literal["draft", "posted", "paid", "void"]


def money(value: Any) -> Decimal:
    """Quantize to cents. None / blank → 0.00."""
    if value is None or value == "":
        return ZERO
    if isinstance(value, Decimal):
        return value.quantize(TWOPLACES, rounding=ROUND_HALF_UP)
    return Decimal(str(value)).quantize(TWOPLACES, rounding=ROUND_HALF_UP)


def ratio(part: Decimal, whole: Decimal) -> Decimal:
    if whole <= ZERO:
        return ZERO
    return (part / whole * Decimal("100")).quantize(TWOPLACES, rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class MoneyLine:
    """One explainable figure: amount + origin + why it is here."""

    amount: Decimal
    origin: DataOrigin
    label: str
    why: str
    source_id: str | None = None
    source_kind: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "amount": float(self.amount),
            "origin": self.origin,
            "label": self.label,
            "why": self.why,
            "source_id": self.source_id,
            "source_kind": self.source_kind,
        }


@dataclass(frozen=True)
class BudgetPosition:
    """Approved / actual / committed / available / forecast — one envelope."""

    approved: Decimal
    actual: Decimal
    committed: Decimal
    forecast_remaining: Decimal
    kind: BudgetKind = "operating"
    label: str = ""

    @property
    def available(self) -> Decimal:
        return money(self.approved - self.actual - self.committed)

    @property
    def projected_year_end(self) -> Decimal:
        return money(self.available - self.forecast_remaining)

    @property
    def variance_to_actual(self) -> Decimal:
        return money(self.approved - self.actual)

    @property
    def percent_spent(self) -> Decimal:
        return ratio(self.actual, self.approved)

    @property
    def percent_committed(self) -> Decimal:
        return ratio(self.committed, self.approved)

    @property
    def percent_available(self) -> Decimal:
        return ratio(self.available, self.approved)

    def explanations(self) -> list[MoneyLine]:
        return [
            MoneyLine(
                self.approved,
                "user_input",
                "Approved",
                "Council / manager approved amount for this envelope. Changing it requires an explicit revision (history keeps ORIGINAL).",
            ),
            MoneyLine(
                self.actual,
                "system",
                "Actual",
                "Posted invoices (and paid invoices). Does not include open purchase orders.",
            ),
            MoneyLine(
                self.committed,
                "system",
                "Committed (encumbered)",
                "Remaining purchase-order balances. A PO creates this; a posted invoice reduces it and increases Actual so the same dollars are never counted twice.",
            ),
            MoneyLine(
                self.available,
                "system",
                "Available",
                f"Approved − Actual − Committed = {self.approved} − {self.actual} − {self.committed} = {self.available}.",
            ),
            MoneyLine(
                self.forecast_remaining,
                "forecast",
                "Forecast remaining",
                "Expected further spend this year from PM, contracts, replacements, deferred work, and planner lines — not a second actual.",
            ),
            MoneyLine(
                self.projected_year_end,
                "forecast",
                "Projected year-end balance",
                f"Available − Forecast remaining = {self.available} − {self.forecast_remaining} = {self.projected_year_end}.",
            ),
        ]

    def as_dict(self) -> dict[str, Any]:
        return {
            "kind": self.kind,
            "label": self.label,
            "approved": float(self.approved),
            "actual": float(self.actual),
            "committed": float(self.committed),
            "available": float(self.available),
            "forecast_remaining": float(self.forecast_remaining),
            "projected_year_end": float(self.projected_year_end),
            "variance_to_actual": float(self.variance_to_actual),
            "percent_spent": float(self.percent_spent),
            "percent_committed": float(self.percent_committed),
            "percent_available": float(self.percent_available),
            "formula": "available = approved − actual − committed",
            "explanations": [e.as_dict() for e in self.explanations()],
        }


def budget_position(
    *,
    approved: Any,
    actual: Any,
    committed: Any,
    forecast_remaining: Any = 0,
    kind: BudgetKind = "operating",
    label: str = "",
) -> BudgetPosition:
    return BudgetPosition(
        approved=money(approved),
        actual=money(actual),
        committed=money(committed),
        forecast_remaining=money(forecast_remaining),
        kind=kind,
        label=label,
    )


@dataclass
class PurchaseOrderState:
    amount: Decimal
    remaining_commitment: Decimal
    status: PoStatus

    def as_dict(self) -> dict[str, Any]:
        return {
            "amount": float(self.amount),
            "remaining_commitment": float(self.remaining_commitment),
            "status": self.status,
        }


def issue_purchase_order(amount: Any) -> PurchaseOrderState:
    amt = money(amount)
    if amt < ZERO:
        raise ValueError("Purchase order amount cannot be negative")
    return PurchaseOrderState(amount=amt, remaining_commitment=amt, status="issued")


def cancel_purchase_order(po: PurchaseOrderState) -> PurchaseOrderState:
    return PurchaseOrderState(amount=po.amount, remaining_commitment=ZERO, status="cancelled")


def apply_posted_invoice(po: PurchaseOrderState | None, invoice_amount: Any) -> tuple[Decimal, PurchaseOrderState | None]:
    """Post an invoice: actual increases by the full amount; remaining PO commitment drops.

    Returns (actual_increase, updated_po_or_none).
    Invoices without a PO still increase actual and do not create commitment.
    """
    inv = money(invoice_amount)
    if inv < ZERO:
        raise ValueError("Invoice amount cannot be negative")
    if po is None or po.status in ("draft", "cancelled", "closed"):
        return inv, po
    remaining = money(po.remaining_commitment - inv)
    if remaining < ZERO:
        remaining = ZERO
    if remaining == ZERO:
        status: PoStatus = "closed"
    elif remaining < po.amount:
        status = "partial"
    else:
        status = po.status
    return inv, PurchaseOrderState(amount=po.amount, remaining_commitment=remaining, status=status)


def void_posted_invoice(po: PurchaseOrderState | None, invoice_amount: Any) -> tuple[Decimal, PurchaseOrderState | None]:
    """Reverse a posted invoice: actual down; remaining commitment restored up to original PO amount."""
    inv = money(invoice_amount)
    if po is None or po.status in ("draft", "cancelled"):
        return money(-inv), po
    restored = money(po.remaining_commitment + inv)
    if restored > po.amount:
        restored = po.amount
    status: PoStatus = "closed" if restored == ZERO else ("issued" if restored == po.amount else "partial")
    return money(-inv), PurchaseOrderState(amount=po.amount, remaining_commitment=restored, status=status)


def inflate(base: Any, annual_rate: Any, years: float) -> Decimal:
    """Compound inflation: base × (1 + rate) ** years."""
    b = money(base)
    r = Decimal(str(annual_rate or 0))
    if years <= 0:
        return b
    factor = (ONE + r) ** Decimal(str(years))
    return money(b * factor)


def apply_contingency(base: Any, contingency_rate: Any) -> Decimal:
    b = money(base)
    r = Decimal(str(contingency_rate or 0))
    if r <= ZERO:
        return b
    return money(b * (ONE + r))


def years_between(start: date | None, end: date | None) -> Decimal | None:
    if start is None or end is None:
        return None
    days = (end - start).days
    return money(Decimal(days) / Decimal("365.25"))


@dataclass(frozen=True)
class AssetLifecycleCalc:
    age_years: Decimal | None
    remaining_useful_life_years: Decimal | None
    planned_replacement_year: int | None
    replacement_cost_now: Decimal
    replacement_cost_at_year: Decimal
    annualized_maintenance: Decimal
    lifecycle_cost_to_date: Decimal
    factors: list[dict[str, Any]] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return {
            "age_years": float(self.age_years) if self.age_years is not None else None,
            "remaining_useful_life_years": (
                float(self.remaining_useful_life_years) if self.remaining_useful_life_years is not None else None
            ),
            "planned_replacement_year": self.planned_replacement_year,
            "replacement_cost_now": float(self.replacement_cost_now),
            "replacement_cost_at_year": float(self.replacement_cost_at_year),
            "annualized_maintenance": float(self.annualized_maintenance),
            "lifecycle_cost_to_date": float(self.lifecycle_cost_to_date),
            "factors": self.factors,
        }


def asset_lifecycle(
    *,
    as_of: date,
    acquisition_date: date | None,
    installation_date: date | None,
    useful_life_years: Any,
    acquisition_cost: Any,
    replacement_value: Any,
    planned_replacement_year: int | None,
    planned_replacement_cost: Any,
    maintenance_cost_to_date: Any,
    inflation_rate: Any,
    contingency_rate: Any,
    condition: str | None = None,
    criticality: str | None = None,
) -> AssetLifecycleCalc:
    start = acquisition_date or installation_date
    age = years_between(start, as_of)
    life = Decimal(str(useful_life_years)) if useful_life_years not in (None, "") else None
    rul: Decimal | None = None
    if age is not None and life is not None:
        rul = money(max(Decimal("0"), life - age))

    year_now = as_of.year
    derived_year: int | None = None
    if planned_replacement_year:
        derived_year = int(planned_replacement_year)
    elif rul is not None:
        derived_year = year_now + int(rul.to_integral_value(rounding=ROUND_HALF_UP))

    cost_now = money(planned_replacement_cost if planned_replacement_cost not in (None, "") else replacement_value)
    years_ahead = max(0, (derived_year or year_now) - year_now)
    cost_at = apply_contingency(inflate(cost_now, inflation_rate, years_ahead), contingency_rate)

    maint = money(maintenance_cost_to_date)
    acq = money(acquisition_cost)
    age_for_annual = age if age is not None and age > ZERO else ONE
    annualized = money(maint / age_for_annual) if maint > ZERO else ZERO

    factors = [
        {"label": "Age (years)", "value": float(age) if age is not None else None, "origin": "system", "why": "Today minus acquisition date (or installation date if acquisition is blank)."},
        {"label": "Useful life (years)", "value": float(life) if life is not None else None, "origin": "user_input", "why": "Coordinator-entered useful life. Blank means remaining life cannot be calculated."},
        {"label": "Remaining useful life", "value": float(rul) if rul is not None else None, "origin": "system", "why": "Useful life − age, floored at zero."},
        {"label": "Replacement cost (today)", "value": float(cost_now), "origin": "user_input", "why": "Planned replacement cost, else current replacement value."},
        {"label": "Inflation / contingency", "value": f"{inflation_rate or 0} / {contingency_rate or 0}", "origin": "user_input", "why": "Budget assumptions. Changing them recalculates the year-of-replacement cost."},
        {"label": "Condition", "value": condition, "origin": "user_input", "why": "Shown as a contributing factor — not rolled into a hidden AI score."},
        {"label": "Criticality", "value": criticality, "origin": "user_input", "why": "Shown as a contributing factor — not rolled into a hidden AI score."},
        {"label": "Maintenance cost to date", "value": float(maint), "origin": "system", "why": "Posted invoices and recorded maintenance spend linked to this asset."},
    ]
    return AssetLifecycleCalc(
        age_years=age,
        remaining_useful_life_years=rul,
        planned_replacement_year=derived_year,
        replacement_cost_now=cost_now,
        replacement_cost_at_year=cost_at,
        annualized_maintenance=annualized,
        lifecycle_cost_to_date=money(acq + maint),
        factors=factors,
    )


def horizon_windows(as_of: date) -> dict[str, date]:
    from datetime import timedelta

    return {
        "d30": as_of + timedelta(days=30),
        "d60": as_of + timedelta(days=60),
        "d90": as_of + timedelta(days=90),
        "m6": as_of + timedelta(days=183),
        "m12": as_of + timedelta(days=365),
    }


def bucket_due_date(as_of: date, due: date) -> str | None:
    windows = horizon_windows(as_of)
    if due < as_of:
        return "overdue"
    if due <= windows["d30"]:
        return "d30"
    if due <= windows["d60"]:
        return "d60"
    if due <= windows["d90"]:
        return "d90"
    if due <= windows["m6"]:
        return "m6"
    if due <= windows["m12"]:
        return "m12"
    return "later"


def combine_positions(parts: Iterable[BudgetPosition], *, kind: BudgetKind, label: str) -> BudgetPosition:
    approved = actual = committed = forecast = ZERO
    for p in parts:
        approved += p.approved
        actual += p.actual
        committed += p.committed
        forecast += p.forecast_remaining
    return budget_position(
        approved=approved,
        actual=actual,
        committed=committed,
        forecast_remaining=forecast,
        kind=kind,
        label=label,
    )


def yoy_change(current: Any, prior: Any) -> dict[str, Any]:
    cur = money(current)
    prev = money(prior)
    delta = money(cur - prev)
    pct = ratio(delta, prev) if prev > ZERO else None
    return {
        "current": float(cur),
        "prior": float(prev),
        "delta": float(delta),
        "percent": float(pct) if pct is not None else None,
        "why": "Current year figure minus the same figure in the prior fiscal year.",
    }


SCENARIO_KINDS = ("replace_now", "replace_next_year", "replace_3_years", "repair_defer", "do_nothing")


def scenario_consequence(
    *,
    kind: str,
    replacement_cost_now: Any,
    repair_cost: Any,
    annual_maintenance: Any,
    inflation_rate: Any,
    risk_note: str | None,
) -> dict[str, Any]:
    now = money(replacement_cost_now)
    repair = money(repair_cost)
    maint = money(annual_maintenance)
    if kind == "replace_now":
        cost = now
        years = 0
        outcome = "Capital spend this year; maintenance on the old unit stops after replacement."
    elif kind == "replace_next_year":
        cost = inflate(now, inflation_rate, 1)
        years = 1
        outcome = "Defer one year: inflated replacement next year plus one year of current maintenance."
        cost = money(cost + maint)
    elif kind == "replace_3_years":
        cost = money(inflate(now, inflation_rate, 3) + maint * Decimal("3"))
        years = 3
        outcome = "Three years of maintenance plus inflated replacement in year three."
    elif kind == "repair_defer":
        cost = money(repair)
        years = 1
        outcome = "Repair now and keep the asset; replacement is deferred. Residual failure risk remains."
    elif kind == "do_nothing":
        cost = ZERO
        years = 0
        outcome = "No spend this year. Service interruption and unplanned failure costs are not estimated unless you enter them."
    else:
        cost = ZERO
        years = 0
        outcome = "Unknown option — no automatic recommendation."
    return {
        "kind": kind,
        "estimated_cost": float(cost),
        "years_deferred": years,
        "outcome": outcome,
        "risk_note": risk_note or "",
        "decision": None,
        "why": "Consequences only. Pulse will not choose replace / repair / defer for you.",
        "origin": "forecast",
    }


def recommendation_guard(action: str) -> dict[str, Any]:
    """AI / assistant must never spend, approve, or encumber without a human click."""
    blocked = {"purchase", "approve", "commit", "issue_po", "post_invoice", "revise_approved"}
    return {
        "allowed": action not in blocked,
        "requires_explicit_user_action": True,
        "action": action,
        "why": "Budget Assistant may explain numbers and suggest legitimate needs. It cannot purchase, approve spend, change approved budgets, or create commitments.",
    }


GLOSSARY: dict[str, str] = {
    "approved": "Money formally authorized for the fiscal year (ORIGINAL or a later REVISED version). History never overwrites ORIGINAL.",
    "actual": "Money already spent — posted or paid invoices. Open POs are not actuals.",
    "committed": "Encumbered but not yet invoiced. Remaining PO balances. Creating a PO raises this; posting an invoice lowers it and raises Actual.",
    "encumbered": "Same as committed — dollars tied up by an issued purchase order.",
    "available": "Approved minus Actual minus Committed. Not Approved minus Actual alone.",
    "forecast": "Expected further spend this year (PM, contracts, replacements, planner). A projection, not a posting.",
    "variance": "Approved minus Actual. Available and projected year-end are shown separately so encumbrances stay visible.",
    "operating": "Routine recreation operations: PM, contractors, utilities, chemicals, inspections, training, rentals.",
    "capital": "Major purchases, replacements, upgrades, and projects (ice plant, pool, HVAC, Zamboni, building, safety systems).",
    "lifecycle": "Age, remaining useful life, maintenance spend to date, and replacement timing/cost for an existing asset.",
    "deferred": "Needed repair or replacement that was not funded this year. Carries risk and future budget pressure.",
    "useful_life": "How many years the asset is expected to serve. Age and remaining life are calculated from this and the acquisition date.",
}


def glossary_payload() -> list[dict[str, str]]:
    return [{"term": k, "definition": v} for k, v in GLOSSARY.items()]


def origin_legend() -> list[dict[str, str]]:
    return [
        {"origin": "system", "meaning": "Calculated from Pulse records (invoices, POs, equipment, PM, work requests)."},
        {"origin": "user_input", "meaning": "Entered by the coordinator (approved amounts, useful life, quotes, assumptions)."},
        {"origin": "forecast", "meaning": "Projected from schedules, inflation, contracts, or replacement timing — not posted spend."},
        {"origin": "ai_recommendation", "meaning": "Suggestion only. Never posts spend, approvals, or commitments without an explicit user action."},
    ]
