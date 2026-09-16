"""Financial & Asset Planning — ledger, forecasts, and Pulse integrations."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.finance_calc import (
    apply_posted_invoice,
    asset_lifecycle,
    budget_position,
    bucket_due_date,
    cancel_purchase_order,
    glossary_payload,
    inflate,
    issue_purchase_order,
    money,
    origin_legend,
    recommendation_guard,
    scenario_consequence,
    void_posted_invoice,
    yoy_change,
    PurchaseOrderState,
)
from app.models.domain import FacilityEquipment
from app.models.finance_models import (
    FinAssetFinancialProfile,
    FinBudget,
    FinBudgetAdjustment,
    FinBudgetAssumption,
    FinBudgetHistory,
    FinBudgetLine,
    FinCapitalItem,
    FinCapitalJustification,
    FinContract,
    FinCostCentre,
    FinDeferredMaintenance,
    FinExpenseCategory,
    FinFiscalYear,
    FinFundingSource,
    FinInvoice,
    FinPurchaseOrder,
    FinQuote,
    FinScenario,
    FinScenarioOption,
)
from app.models.ops_foundation_models import OpsRegulation
from app.models.pm_models import PmTask
from app.models.pulse_models import PulseProject, PulseWorkRequest, PulseWorkRequestStatus

POSTED_INVOICE = frozenset({"posted", "paid"})
OPEN_PO = frozenset({"issued", "partial"})
OPEN_WR = frozenset(
    {
        PulseWorkRequestStatus.open,
        PulseWorkRequestStatus.in_progress,
        PulseWorkRequestStatus.hold,
    }
)

OPERATING_CATEGORIES = (
    ("routine", "Routine operations", 10),
    ("pm", "Preventive maintenance", 20),
    ("corrective", "Corrective maintenance", 30),
    ("contractors", "Contractors", 40),
    ("service_agreements", "Service agreements", 50),
    ("utilities", "Utilities", 60),
    ("supplies", "Supplies", 70),
    ("chemicals", "Chemicals", 80),
    ("parts", "Parts", 90),
    ("equipment", "Equipment (operating)", 100),
    ("inspections", "Inspections", 110),
    ("regulatory", "Regulatory", 120),
    ("training", "Training", 130),
    ("rentals", "Rentals", 140),
    ("other", "Other operating", 150),
)
CAPITAL_CATEGORIES = (
    ("projects", "Capital projects", 10),
    ("purchases", "Major purchases", 20),
    ("replacements", "Replacements", 30),
    ("upgrades", "Upgrades", 40),
    ("refrigeration", "Refrigeration / ice plant", 50),
    ("pool", "Pool systems", 60),
    ("hvac", "HVAC", 70),
    ("zamboni", "Zamboni / resurfacer", 80),
    ("building", "Building", 90),
    ("safety_systems", "Safety systems", 100),
)
COST_CENTRES = (
    ("REC", "Recreation operations", "recreation"),
    ("ARENA", "Arena / ice", "recreation"),
    ("AQU", "Aquatics", "recreation"),
    ("FAC", "Facilities", "recreation"),
)
FUNDING_SEEDS = (
    ("Taxation", "taxation"),
    ("Reserves", "reserve"),
    ("Grants", "grant"),
)


def _id() -> str:
    return str(uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _f(value: Any) -> float:
    return float(money(value))


def _d(row: Any) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for col in row.__table__.columns:
        val = getattr(row, col.name)
        if isinstance(val, Decimal):
            out[col.name] = float(val)
        elif isinstance(val, datetime):
            out[col.name] = val.isoformat()
        elif isinstance(val, date):
            out[col.name] = val.isoformat()
        else:
            out[col.name] = val
    return out


_MONEY_KEYS = frozenset(
    {
        "amount",
        "remaining_commitment",
        "approved_amount",
        "forecast_amount",
        "estimated_cost",
        "acquisition_cost",
        "replacement_value",
        "planned_replacement_cost",
        "maintenance_cost_to_date",
        "last_failure_cost",
        "annual_cost",
        "amount_available",
        "repair_cost",
    }
)
_RATE_KEYS = frozenset({"inflation_rate", "contingency_rate", "inflation_override", "contingency_override"})
_DATE_KEYS = frozenset({"starts_on", "ends_on", "renewal_on", "invoice_date", "acquisition_date", "as_of"})
_BOOL_KEYS = frozenset({"regulatory", "safety", "active"})


def _coerce_field(key: str, val: Any) -> Any:
    if val is None or val == "":
        if key.endswith("_id") or key in _DATE_KEYS or key in _RATE_KEYS:
            return None
        return val
    if key in _BOOL_KEYS:
        if isinstance(val, bool):
            return val
        return str(val).strip().lower() in {"1", "true", "yes", "on"}
    if key in _DATE_KEYS and isinstance(val, str):
        return date.fromisoformat(val[:10])
    if key in _RATE_KEYS:
        return Decimal(str(val))
    if key in _MONEY_KEYS:
        return money(val)
    if key in {"start_year", "end_year", "year", "useful_life_years", "planned_replacement_year"}:
        return int(val)
    return val


async def _one(db: AsyncSession, model: type, company_id: str, item_id: str) -> Any:
    row = await db.get(model, item_id)
    if row is None or str(row.company_id) != company_id:
        raise HTTPException(status_code=404, detail="Not found")
    return row


async def ensure_defaults(db: AsyncSession, company_id: str, *, actor_id: str | None = None) -> FinFiscalYear:
    year = date.today().year
    fy = (
        await db.execute(
            select(FinFiscalYear).where(FinFiscalYear.company_id == company_id, FinFiscalYear.year == year)
        )
    ).scalar_one_or_none()
    if fy is None:
        fy = FinFiscalYear(
            id=_id(),
            company_id=company_id,
            year=year,
            starts_on=date(year, 1, 1),
            ends_on=date(year, 12, 31),
            status="open",
        )
        db.add(fy)
        await db.flush()

    assume = (
        await db.execute(
            select(FinBudgetAssumption).where(
                FinBudgetAssumption.company_id == company_id,
                FinBudgetAssumption.fiscal_year_id == fy.id,
            )
        )
    ).scalar_one_or_none()
    if assume is None:
        db.add(
            FinBudgetAssumption(
                id=_id(),
                company_id=company_id,
                fiscal_year_id=fy.id,
                inflation_rate=Decimal("0.0300"),
                contingency_rate=Decimal("0.1000"),
                source="Default municipal planning rates — edit to match finance.",
                as_of=date.today(),
            )
        )

    existing_cc = (
        await db.execute(select(func.count()).select_from(FinCostCentre).where(FinCostCentre.company_id == company_id))
    ).scalar_one()
    if int(existing_cc or 0) == 0:
        for code, name, dept in COST_CENTRES:
            db.add(FinCostCentre(id=_id(), company_id=company_id, code=code, name=name, department=dept))

    existing_fs = (
        await db.execute(select(func.count()).select_from(FinFundingSource).where(FinFundingSource.company_id == company_id))
    ).scalar_one()
    if int(existing_fs or 0) == 0:
        for name, kind in FUNDING_SEEDS:
            db.add(FinFundingSource(id=_id(), company_id=company_id, name=name, kind=kind, amount_available=Decimal("0")))

    existing_cat = (
        await db.execute(select(FinExpenseCategory.code).where(FinExpenseCategory.company_id == company_id))
    ).scalars().all()
    have = set(existing_cat)
    for code, name, order in OPERATING_CATEGORIES:
        if code not in have:
            db.add(
                FinExpenseCategory(
                    id=_id(), company_id=company_id, code=code, name=name, kind="operating", sort_order=order
                )
            )
    for code, name, order in CAPITAL_CATEGORIES:
        if code not in have:
            db.add(
                FinExpenseCategory(
                    id=_id(), company_id=company_id, code=code, name=name, kind="capital", sort_order=order
                )
            )
    await db.flush()

    for kind, title in (("operating", f"{year} operating budget"), ("capital", f"{year} capital budget")):
        existing = (
            await db.execute(
                select(FinBudget).where(
                    FinBudget.company_id == company_id,
                    FinBudget.fiscal_year_id == fy.id,
                    FinBudget.kind == kind,
                )
            )
        ).scalar_one_or_none()
        if existing is None:
            budget = FinBudget(
                id=_id(),
                company_id=company_id,
                fiscal_year_id=fy.id,
                kind=kind,
                name=title,
                status="original",
                created_by_user_id=actor_id,
            )
            db.add(budget)
            await db.flush()
            cats = (
                await db.execute(
                    select(FinExpenseCategory).where(
                        FinExpenseCategory.company_id == company_id,
                        FinExpenseCategory.kind == kind,
                    )
                )
            ).scalars().all()
            for cat in cats:
                db.add(
                    FinBudgetLine(
                        id=_id(),
                        company_id=company_id,
                        budget_id=budget.id,
                        category_id=cat.id,
                        name=cat.name,
                        approved_amount=Decimal("0"),
                        forecast_amount=Decimal("0"),
                        source_kind="user_input",
                        source_note="Seeded category line — enter the approved amount.",
                    )
                )
            db.add(
                FinBudgetHistory(
                    id=_id(),
                    company_id=company_id,
                    budget_id=budget.id,
                    version_kind="ORIGINAL",
                    snapshot={"kind": kind, "year": year, "lines": []},
                    note="Opened with category lines at zero. ORIGINAL is never overwritten.",
                    created_by_user_id=actor_id,
                )
            )
    await db.flush()
    return fy


async def _assumptions(db: AsyncSession, company_id: str, fy: FinFiscalYear) -> FinBudgetAssumption:
    row = (
        await db.execute(
            select(FinBudgetAssumption).where(
                FinBudgetAssumption.company_id == company_id,
                FinBudgetAssumption.fiscal_year_id == fy.id,
            )
        )
    ).scalar_one_or_none()
    if row is None:
        row = FinBudgetAssumption(
            id=_id(),
            company_id=company_id,
            fiscal_year_id=fy.id,
            inflation_rate=Decimal("0.0300"),
            contingency_rate=Decimal("0.1000"),
        )
        db.add(row)
        await db.flush()
    return row


async def _budgets_for_year(db: AsyncSession, company_id: str, fy_id: str) -> list[FinBudget]:
    return list(
        (
            await db.execute(
                select(FinBudget).where(FinBudget.company_id == company_id, FinBudget.fiscal_year_id == fy_id)
            )
        )
        .scalars()
        .all()
    )


async def _sum_invoices(
    db: AsyncSession,
    company_id: str,
    *,
    line_ids: list[str] | None = None,
    capital_ids: list[str] | None = None,
    start: date | None = None,
    end: date | None = None,
) -> Decimal:
    stmt: Select[Any] = select(func.coalesce(func.sum(FinInvoice.amount), 0)).where(
        FinInvoice.company_id == company_id,
        FinInvoice.status.in_(tuple(POSTED_INVOICE)),
    )
    if line_ids is not None:
        if not line_ids:
            return money(0)
        stmt = stmt.where(FinInvoice.budget_line_id.in_(line_ids))
    if capital_ids is not None:
        if not capital_ids:
            return money(0)
        stmt = stmt.where(FinInvoice.capital_item_id.in_(capital_ids))
    if start:
        stmt = stmt.where(or_(FinInvoice.invoice_date.is_(None), FinInvoice.invoice_date >= start))
    if end:
        stmt = stmt.where(or_(FinInvoice.invoice_date.is_(None), FinInvoice.invoice_date <= end))
    return money((await db.execute(stmt)).scalar_one())


async def _sum_commitments(
    db: AsyncSession,
    company_id: str,
    *,
    line_ids: list[str] | None = None,
    capital_ids: list[str] | None = None,
) -> Decimal:
    stmt: Select[Any] = select(func.coalesce(func.sum(FinPurchaseOrder.remaining_commitment), 0)).where(
        FinPurchaseOrder.company_id == company_id,
        FinPurchaseOrder.status.in_(tuple(OPEN_PO)),
    )
    if line_ids is not None:
        if not line_ids:
            return money(0)
        stmt = stmt.where(FinPurchaseOrder.budget_line_id.in_(line_ids))
    if capital_ids is not None:
        if not capital_ids:
            return money(0)
        stmt = stmt.where(FinPurchaseOrder.capital_item_id.in_(capital_ids))
    return money((await db.execute(stmt)).scalar_one())


async def _line_ids_for_kind(db: AsyncSession, budgets: list[FinBudget], kind: str) -> list[str]:
    ids = [b.id for b in budgets if b.kind == kind]
    if not ids:
        return []
    rows = (
        await db.execute(select(FinBudgetLine.id).where(FinBudgetLine.budget_id.in_(ids)))
    ).scalars().all()
    return [str(x) for x in rows]


async def _approved_for_kind(db: AsyncSession, budgets: list[FinBudget], kind: str) -> Decimal:
    ids = [b.id for b in budgets if b.kind == kind]
    if not ids:
        return money(0)
    return money(
        (
            await db.execute(
                select(func.coalesce(func.sum(FinBudgetLine.approved_amount), 0)).where(FinBudgetLine.budget_id.in_(ids))
            )
        ).scalar_one()
    )


async def _user_forecast_for_kind(db: AsyncSession, budgets: list[FinBudget], kind: str) -> Decimal:
    ids = [b.id for b in budgets if b.kind == kind]
    if not ids:
        return money(0)
    return money(
        (
            await db.execute(
                select(func.coalesce(func.sum(FinBudgetLine.forecast_amount), 0)).where(FinBudgetLine.budget_id.in_(ids))
            )
        ).scalar_one()
    )


async def service_forecast(db: AsyncSession, company_id: str, fy: FinFiscalYear) -> dict[str, Any]:
    as_of = date.today()
    tasks = list(
        (
            await db.execute(
                select(PmTask, FacilityEquipment)
                .outerjoin(FacilityEquipment, FacilityEquipment.id == PmTask.equipment_id)
                .where(PmTask.company_id == company_id)
            )
        ).all()
    )
    buckets: dict[str, list[dict[str, Any]]] = {
        "overdue": [],
        "d30": [],
        "d60": [],
        "d90": [],
        "m6": [],
        "m12": [],
        "later": [],
    }
    total = money(0)
    year_total = money(0)
    for task, eq in tasks:
        due = task.next_due_at.date() if task.next_due_at else None
        if due is None:
            continue
        cost = money(task.estimated_cost)
        item = {
            "id": task.id,
            "asset": eq.name if eq else None,
            "equipment_id": str(task.equipment_id) if task.equipment_id else None,
            "service": task.name,
            "due": due.isoformat(),
            "cost": _f(cost),
            "category": "pm",
            "origin": "system" if cost > 0 else "user_input",
            "why": (
                "PM schedule next due date × estimated_cost on the PM task."
                if cost > 0
                else "PM is scheduled but estimated_cost is blank — cost is missing data, not zero spend."
            ),
            "budget_status": "costed" if cost > 0 else "missing_cost",
            "vendor": None,
            "regulatory": False,
        }
        bucket = bucket_due_date(as_of, due) or "later"
        buckets.setdefault(bucket, []).append(item)
        if cost > 0:
            total += cost
            if fy.starts_on <= due <= fy.ends_on:
                year_total += cost
    return {
        "as_of": as_of.isoformat(),
        "windows": {k: v for k, v in buckets.items()},
        "window_totals": {k: _f(sum((money(i["cost"]) for i in v), money(0))) for k, v in buckets.items()},
        "year_forecast": _f(year_total),
        "horizon_forecast": _f(total),
        "missing_cost_count": sum(1 for v in buckets.values() for i in v if i["budget_status"] == "missing_cost"),
        "why": "Upcoming expenditures come from preventive maintenance next_due_at. Amounts are the PM estimated_cost field — they are forecasts until a PO or invoice exists.",
    }


async def replacement_forecast(
    db: AsyncSession, company_id: str, fy: FinFiscalYear, assume: FinBudgetAssumption
) -> dict[str, Any]:
    as_of = date.today()
    eq_rows = list(
        (await db.execute(select(FacilityEquipment).where(FacilityEquipment.company_id == company_id))).scalars().all()
    )
    profiles = {
        str(p.equipment_id): p
        for p in (
            await db.execute(
                select(FinAssetFinancialProfile).where(FinAssetFinancialProfile.company_id == company_id)
            )
        )
        .scalars()
        .all()
    }
    pm_by_eq: dict[str, list[PmTask]] = {}
    for task in (
        await db.execute(select(PmTask).where(PmTask.company_id == company_id))
    ).scalars().all():
        if task.equipment_id:
            pm_by_eq.setdefault(str(task.equipment_id), []).append(task)
    by_year: dict[int, list[dict[str, Any]]] = {}
    items: list[dict[str, Any]] = []
    this_year = money(0)
    for eq in eq_rows:
        prof = profiles.get(str(eq.id))
        calc = asset_lifecycle(
            as_of=as_of,
            acquisition_date=prof.acquisition_date if prof else None,
            installation_date=eq.installation_date,
            useful_life_years=prof.useful_life_years if prof else None,
            acquisition_cost=prof.acquisition_cost if prof else None,
            replacement_value=prof.replacement_value if prof else None,
            planned_replacement_year=prof.planned_replacement_year if prof else None,
            planned_replacement_cost=prof.planned_replacement_cost if prof else None,
            maintenance_cost_to_date=prof.maintenance_cost_to_date if prof else None,
            inflation_rate=prof.inflation_override if prof and prof.inflation_override is not None else assume.inflation_rate,
            contingency_rate=(
                prof.contingency_override if prof and prof.contingency_override is not None else assume.contingency_rate
            ),
            condition=prof.condition if prof else None,
            criticality=prof.criticality if prof else None,
        )
        row = {
            "equipment_id": eq.id,
            "name": eq.name,
            "type": eq.type,
            "facility_id": eq.ops_facility_id,
            "profile_id": prof.id if prof else None,
            "condition": prof.condition if prof else None,
            "criticality": prof.criticality if prof else None,
            **calc.as_dict(),
        }
        tasks = pm_by_eq.get(str(eq.id), [])
        next_task = min((t for t in tasks if t.next_due_at), key=lambda t: t.next_due_at, default=None)
        last_task = max((t for t in tasks if t.last_completed_at), key=lambda t: t.last_completed_at, default=None)
        row["next_service"] = (
            {
                "name": next_task.name,
                "due": next_task.next_due_at.date().isoformat() if next_task.next_due_at else None,
                "cost": _f(next_task.estimated_cost),
            }
            if next_task
            else None
        )
        row["last_service"] = (
            {
                "name": last_task.name if last_task else None,
                "completed": last_task.last_completed_at.isoformat() if last_task and last_task.last_completed_at else None,
            }
            if last_task
            else None
        )
        items.append(row)
        yr = calc.planned_replacement_year
        if yr:
            by_year.setdefault(yr, []).append(row)
            if yr == fy.year:
                this_year += calc.replacement_cost_at_year
    horizon = {str(y): {"count": len(v), "cost": _f(sum((money(i["replacement_cost_at_year"]) for i in v), money(0)))} for y, v in sorted(by_year.items())}
    return {
        "as_of": as_of.isoformat(),
        "items": items,
        "by_year": horizon,
        "this_year_cost": _f(this_year),
        "views": {str(h): {k: v for k, v in horizon.items() if int(k) <= fy.year + h} for h in (1, 2, 3, 5, 10)},
        "why": "Replacement year is planned_replacement_year, else current year + remaining useful life. Cost uses replacement value inflated and contingencied from budget assumptions unless the asset overrides them.",
    }


async def deferred_register(db: AsyncSession, company_id: str) -> dict[str, Any]:
    items = list(
        (
            await db.execute(
                select(FinDeferredMaintenance).where(FinDeferredMaintenance.company_id == company_id)
            )
        )
        .scalars()
        .all()
    )
    wr_open = list(
        (
            await db.execute(
                select(PulseWorkRequest).where(
                    PulseWorkRequest.company_id == company_id,
                    PulseWorkRequest.status.in_(tuple(OPEN_WR)),
                )
            )
        )
        .scalars()
        .all()
    )
    linked = {str(i.work_request_id) for i in items if i.work_request_id}
    backlog = [
        {
            "id": wr.id,
            "title": wr.title,
            "equipment_id": wr.equipment_id,
            "status": wr.status.value if hasattr(wr.status, "value") else str(wr.status),
            "priority": wr.priority.value if hasattr(wr.priority, "value") else str(wr.priority),
            "kind": wr.work_order_type.value if hasattr(wr.work_order_type, "value") else str(wr.work_order_type),
            "origin": "system",
            "why": "Open work request — not yet a deferred-maintenance dollar amount unless you add a register item.",
            "in_register": wr.id in linked,
        }
        for wr in wr_open
    ]
    open_items = [i for i in items if i.status == "open"]
    return {
        "items": [_d(i) for i in items],
        "open_count": len(open_items),
        "open_cost": _f(sum((money(i.estimated_cost) for i in open_items), money(0))),
        "work_request_backlog": backlog,
        "why": "The register is the funded/unfunded queue. Open work requests are shown so you can promote them into a costed deferred item instead of duplicating the asset master.",
    }


async def _contract_year_forecast(db: AsyncSession, company_id: str, fy: FinFiscalYear) -> Decimal:
    rows = list(
        (
            await db.execute(
                select(FinContract).where(FinContract.company_id == company_id, FinContract.status == "active")
            )
        )
        .scalars()
        .all()
    )
    total = money(0)
    for c in rows:
        if c.ends_on and c.ends_on < fy.starts_on:
            continue
        if c.starts_on and c.starts_on > fy.ends_on:
            continue
        total += money(c.annual_cost)
    return total


async def dashboard(db: AsyncSession, company_id: str, *, actor_id: str | None = None) -> dict[str, Any]:
    fy = await ensure_defaults(db, company_id, actor_id=actor_id)
    assume = await _assumptions(db, company_id, fy)
    budgets = await _budgets_for_year(db, company_id, fy.id)
    op_lines = await _line_ids_for_kind(db, budgets, "operating")
    cap_lines = await _line_ids_for_kind(db, budgets, "capital")
    cap_item_rows = list(
        (await db.execute(select(FinCapitalItem).where(FinCapitalItem.company_id == company_id))).scalars().all()
    )
    cap_item_ids = [str(i.id) for i in cap_item_rows]
    op_approved = await _approved_for_kind(db, budgets, "operating")
    cap_approved = await _approved_for_kind(db, budgets, "capital")
    cap_approved = money(
        cap_approved
        + sum((money(i.approved_amount) for i in cap_item_rows if not i.budget_line_id), money(0))
    )
    op_actual = await _sum_invoices(db, company_id, line_ids=op_lines, start=fy.starts_on, end=fy.ends_on)
    cap_from_lines = await _sum_invoices(db, company_id, line_ids=cap_lines, start=fy.starts_on, end=fy.ends_on)
    cap_from_items = (
        await _sum_invoices(db, company_id, capital_ids=cap_item_ids, start=fy.starts_on, end=fy.ends_on)
        if cap_item_ids
        else money(0)
    )
    cap_overlap = (
        await _sum_invoices(
            db, company_id, line_ids=cap_lines, capital_ids=cap_item_ids, start=fy.starts_on, end=fy.ends_on
        )
        if cap_lines and cap_item_ids
        else money(0)
    )
    cap_actual = money(cap_from_lines + cap_from_items - cap_overlap)
    unallocated_actual = await _sum_invoices(db, company_id, start=fy.starts_on, end=fy.ends_on)
    leftover_actual = money(unallocated_actual - op_actual - cap_actual)
    if leftover_actual > 0:
        op_actual = money(op_actual + leftover_actual)

    op_commit = await _sum_commitments(db, company_id, line_ids=op_lines)
    cap_commit_lines = await _sum_commitments(db, company_id, line_ids=cap_lines)
    cap_commit_items = await _sum_commitments(db, company_id, capital_ids=cap_item_ids) if cap_item_ids else money(0)
    cap_commit_overlap = (
        await _sum_commitments(db, company_id, line_ids=cap_lines, capital_ids=cap_item_ids)
        if cap_lines and cap_item_ids
        else money(0)
    )
    cap_commit = money(cap_commit_lines + cap_commit_items - cap_commit_overlap)
    all_commit = await _sum_commitments(db, company_id)
    leftover_commit = money(all_commit - op_commit - cap_commit)
    if leftover_commit > 0:
        op_commit = money(op_commit + leftover_commit)

    svc = await service_forecast(db, company_id, fy)
    repl = await replacement_forecast(db, company_id, fy, assume)
    deferred = await deferred_register(db, company_id)
    contracts = await _contract_year_forecast(db, company_id, fy)
    user_op_forecast = await _user_forecast_for_kind(db, budgets, "operating")
    user_cap_forecast = await _user_forecast_for_kind(db, budgets, "capital")

    op_forecast = money(user_op_forecast + money(svc["year_forecast"]) + contracts)
    cap_forecast = money(user_cap_forecast + money(repl["this_year_cost"]))

    operating = budget_position(
        approved=op_approved,
        actual=op_actual,
        committed=op_commit,
        forecast_remaining=op_forecast,
        kind="operating",
        label="Operating",
    )
    capital = budget_position(
        approved=cap_approved,
        actual=cap_actual,
        committed=cap_commit,
        forecast_remaining=cap_forecast,
        kind="capital",
        label="Capital",
    )
    combined = budget_position(
        approved=op_approved + cap_approved,
        actual=unallocated_actual,
        committed=all_commit,
        forecast_remaining=op_forecast + cap_forecast,
        kind="operating",
        label="Combined",
    )
    prior_year = fy.year - 1
    prior = (
        await db.execute(
            select(FinFiscalYear).where(FinFiscalYear.company_id == company_id, FinFiscalYear.year == prior_year)
        )
    ).scalar_one_or_none()
    prior_actual = money(0)
    if prior:
        prior_actual = await _sum_invoices(db, company_id, start=prior.starts_on, end=prior.ends_on)

    alerts = await build_alerts(
        db,
        company_id,
        fy=fy,
        assume=assume,
        operating=operating,
        capital=capital,
        combined=combined,
        deferred=deferred,
        repl=repl,
        svc=svc,
    )
    return {
        "fiscal_year": _d(fy),
        "assumptions": _d(assume),
        "operating": operating.as_dict(),
        "capital": capital.as_dict(),
        "combined": combined.as_dict(),
        "yoy_actual": yoy_change(combined.actual, prior_actual),
        "deferred_maintenance": {"count": deferred["open_count"], "cost": deferred["open_cost"]},
        "upcoming_replacements": _dashboard_replacements(repl, fy.year),
        "upcoming_expenditures": _upcoming_expenditures(svc),
        "upcoming_capital": _upcoming_capital(repl, cap_item_rows, fy.year),
        "monthly_actuals": await _monthly_actuals(db, company_id, fy),
        "service_forecast": {
            "year_forecast": svc["year_forecast"],
            "d30": svc["window_totals"].get("d30", 0),
            "d90": svc["window_totals"].get("d90", 0),
            "missing_cost_count": svc["missing_cost_count"],
        },
        "contracts_annual": _f(contracts),
        "alerts": alerts,
        "glossary": glossary_payload(),
        "origins": origin_legend(),
        "ai_guard": recommendation_guard("explain"),
    }


async def build_alerts(db: AsyncSession, company_id: str, **ctx: Any) -> list[dict[str, Any]]:
    fy: FinFiscalYear = ctx["fy"]
    operating = ctx["operating"]
    capital = ctx["capital"]
    combined = ctx["combined"]
    deferred = ctx["deferred"]
    repl = ctx["repl"]
    svc = ctx["svc"]
    alerts: list[dict[str, Any]] = []

    def add(kind: str, severity: str, title: str, why: str, href: str) -> None:
        alerts.append({"kind": kind, "severity": severity, "title": title, "why": why, "href": href, "origin": "system"})

    if combined.approved > 0 and combined.percent_spent >= Decimal("90"):
        add("approaching_limit", "warning", "Approaching approved limit", f"{combined.percent_spent}% of combined approved is spent.", "/finance/dashboard")
    if combined.projected_year_end < 0:
        add("overrun_forecast", "critical", "Overrun forecast", f"Projected year-end balance is {combined.projected_year_end}.", "/finance/operating/forecast")
    if combined.available > 0 and combined.committed == 0 and combined.percent_available >= Decimal("20"):
        add("large_uncommitted", "info", "Large uncommitted remainder", f"Available {combined.available} is unencumbered. See Budget Opportunities before spending it.", "/finance/opportunities")
    this_year_repl = money(repl.get("this_year_cost") or 0)
    if this_year_repl >= money(10000):
        add("major_upcoming", "warning", "Major upcoming capital", f"Replacements in {fy.year} total {this_year_repl}.", "/finance/lifecycle/replacement")
    if this_year_repl > capital.approved:
        add(
            "capital_gap",
            "warning",
            "Capital gap",
            f"This year's replacement forecast {this_year_repl} exceeds approved capital {capital.approved}.",
            "/finance/planner/long-range",
        )
    near = [i for i in repl.get("items") or [] if i.get("remaining_useful_life_years") is not None and i["remaining_useful_life_years"] <= 1]
    if near:
        add("replacement_approaching", "warning", "Replacement approaching", f"{len(near)} asset(s) have a year or less of remaining useful life.", "/finance/lifecycle/replacement")
    renewals = list(
        (
            await db.execute(
                select(FinContract).where(
                    FinContract.company_id == company_id,
                    FinContract.status == "active",
                    FinContract.renewal_on.is_not(None),
                    FinContract.renewal_on <= date.today() + timedelta(days=90),
                )
            )
        )
        .scalars()
        .all()
    )
    if renewals:
        add("contract_renewal", "info", "Contract renewal within 90 days", ", ".join(c.title for c in renewals[:4]), "/finance/procurement/contracts")
    if any(i.get("regulatory") for i in deferred.get("items") or [] if i.get("status") == "open"):
        add("regulatory_spend", "warning", "Regulatory deferred maintenance", "Open deferred items flagged regulatory still have no commitment.", "/finance/deferred")
    if svc.get("missing_cost_count"):
        add("pm_no_budget", "info", "PM with no estimated cost", f"{svc['missing_cost_count']} upcoming PM task(s) have no estimated_cost.", "/finance/lifecycle/service")
    over = await _capital_over_approved(db, company_id)
    if over:
        add("project_over_approved", "critical", "Capital item over approved", f"{len(over)} capital item(s) have actual + committed above approved.", "/finance/capital/projects")
    regs = (
        await db.execute(select(func.count()).select_from(OpsRegulation).where(OpsRegulation.company_id == company_id))
    ).scalar_one()
    if int(regs or 0) and not any(i.get("kind") == "regulatory_spend" for i in alerts):
        add(
            "regulatory_uncosted",
            "info",
            "Codes & Guidance has no dollar amounts",
            f"{int(regs)} regulatory cards can imply inspection/training cost but Pulse does not invent a price. Add a budget line or deferred item when you know the cost.",
            "/recreation/regulations",
        )
    return alerts


async def _capital_over_approved(db: AsyncSession, company_id: str) -> list[FinCapitalItem]:
    items = list(
        (await db.execute(select(FinCapitalItem).where(FinCapitalItem.company_id == company_id))).scalars().all()
    )
    over: list[FinCapitalItem] = []
    for item in items:
        actual = await _sum_invoices(db, company_id, capital_ids=[item.id])
        committed = await _sum_commitments(db, company_id, capital_ids=[item.id])
        if money(item.approved_amount) > 0 and actual + committed > money(item.approved_amount):
            over.append(item)
    return over


def _dashboard_replacements(repl: dict[str, Any], year: int) -> dict[str, Any]:
    bucket = repl.get("by_year", {}).get(str(year), {})
    return {"this_year_cost": repl.get("this_year_cost", 0), "count": bucket.get("count", 0)}


def _upcoming_expenditures(svc: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for horizon in ("overdue", "d30", "d60", "d90"):
        for item in svc.get("windows", {}).get(horizon) or []:
            rows.append({**item, "horizon": horizon})
    return rows


def _upcoming_capital(repl: dict[str, Any], items: list[FinCapitalItem], year: int) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for asset in repl.get("items") or []:
        if asset.get("planned_replacement_year") == year:
            rows.append(
                {
                    "kind": "replacement",
                    "name": asset.get("name"),
                    "year": year,
                    "amount": asset.get("replacement_cost_at_year") or 0,
                    "origin": "forecast",
                    "why": "Replacement year from useful life / planned year.",
                }
            )
    for item in items:
        if item.start_year == year or (not item.start_year and item.end_year == year):
            rows.append(
                {
                    "kind": item.kind,
                    "name": item.name,
                    "year": item.start_year or year,
                    "amount": _f(item.estimated_cost or item.approved_amount),
                    "origin": "user_input",
                    "why": "Capital item planned to start this fiscal year.",
                }
            )
    return rows


async def _monthly_actuals(db: AsyncSession, company_id: str, fy: FinFiscalYear) -> list[dict[str, Any]]:
    invoices = list(
        (
            await db.execute(
                select(FinInvoice).where(
                    FinInvoice.company_id == company_id,
                    FinInvoice.status.in_(tuple(POSTED_INVOICE)),
                )
            )
        )
        .scalars()
        .all()
    )
    months = {f"{fy.year}-{m:02d}": money(0) for m in range(1, 13)}
    for inv in invoices:
        d = inv.invoice_date or (inv.posted_at.date() if inv.posted_at else None)
        if d is None or d < fy.starts_on or d > fy.ends_on:
            continue
        key = f"{d.year}-{d.month:02d}"
        if key in months:
            months[key] = money(months[key] + money(inv.amount))
    return [
        {
            "month": key,
            "actual": _f(amt),
            "origin": "system",
            "why": "Posted invoices dated in this month (invoice_date, else posted_at).",
        }
        for key, amt in months.items()
    ]


async def operating_detail(db: AsyncSession, company_id: str, view: str) -> dict[str, Any]:
    snap = await dashboard(db, company_id)
    fy = await ensure_defaults(db, company_id)
    budgets = await _budgets_for_year(db, company_id, fy.id)
    budget = next((b for b in budgets if b.kind == "operating"), None)
    lines = []
    if budget:
        raw_lines = list(
            (await db.execute(select(FinBudgetLine).where(FinBudgetLine.budget_id == budget.id))).scalars().all()
        )
        cats = {
            c.id: c
            for c in (
                await db.execute(select(FinExpenseCategory).where(FinExpenseCategory.company_id == company_id))
            )
            .scalars()
            .all()
        }
        for line in raw_lines:
            actual = await _sum_invoices(db, company_id, line_ids=[line.id], start=fy.starts_on, end=fy.ends_on)
            committed = await _sum_commitments(db, company_id, line_ids=[line.id])
            pos = budget_position(
                approved=line.approved_amount,
                actual=actual,
                committed=committed,
                forecast_remaining=line.forecast_amount,
                kind="operating",
                label=line.name,
            )
            cat = cats.get(line.category_id) if line.category_id else None
            lines.append(
                {
                    **_d(line),
                    "category_code": cat.code if cat else None,
                    "position": pos.as_dict(),
                    "overrun": pos.available < 0,
                    "unused": _f(pos.available) if pos.actual == 0 and pos.committed == 0 else 0,
                }
            )
    invoices = list(
        (
            await db.execute(
                select(FinInvoice)
                .where(FinInvoice.company_id == company_id, FinInvoice.status.in_(tuple(POSTED_INVOICE)))
                .order_by(FinInvoice.posted_at.desc().nullslast())
                .limit(100)
            )
        )
        .scalars()
        .all()
    )
    pos = list(
        (
            await db.execute(
                select(FinPurchaseOrder)
                .where(FinPurchaseOrder.company_id == company_id, FinPurchaseOrder.status.in_(tuple(OPEN_PO)))
            )
        )
        .scalars()
        .all()
    )
    unused = [l for l in lines if l["unused"]]
    overruns = [l for l in lines if l["overrun"]]
    return {
        "view": view,
        "dashboard": snap["operating"],
        "yoy_actual": snap["yoy_actual"],
        "monthly": snap.get("monthly_actuals") or [],
        "lines": lines,
        "overruns": overruns,
        "unused": unused,
        "invoices": [_d(x) for x in invoices] if view in ("actuals", "variance") else [],
        "commitments": [_d(x) for x in pos] if view in ("commitments", "variance") else [],
        "why": {
            "actuals": "Posted and paid invoices. Open POs are not listed here.",
            "commitments": "Issued / partial purchase orders and their remaining encumbrance.",
            "forecast": "PM + contracts + planner forecast lines. Distinct from actual and committed.",
            "variance": "Approved versus actual, with available (approved − actual − committed) beside it.",
        }.get(view, ""),
    }


async def capital_detail(db: AsyncSession, company_id: str, view: str) -> dict[str, Any]:
    snap = await dashboard(db, company_id)
    kind_map = {"projects": "project", "purchases": "purchase", "replacements": "replacement"}
    want = kind_map.get(view)
    items = list(
        (await db.execute(select(FinCapitalItem).where(FinCapitalItem.company_id == company_id))).scalars().all()
    )
    if want:
        items = [i for i in items if i.kind == want]
    out = []
    for item in items:
        actual = await _sum_invoices(db, company_id, capital_ids=[item.id])
        committed = await _sum_commitments(db, company_id, capital_ids=[item.id])
        pos = budget_position(
            approved=item.approved_amount or item.estimated_cost,
            actual=actual,
            committed=committed,
            forecast_remaining=max(Decimal("0"), money(item.estimated_cost) - actual - committed),
            kind="capital",
            label=item.name,
        )
        project = await db.get(PulseProject, item.project_id) if item.project_id else None
        eq = await db.get(FacilityEquipment, item.equipment_id) if item.equipment_id else None
        funding = await db.get(FinFundingSource, item.funding_source_id) if item.funding_source_id else None
        quotes = list(
            (
                await db.execute(
                    select(FinQuote).where(FinQuote.company_id == company_id, FinQuote.capital_item_id == item.id)
                )
            )
            .scalars()
            .all()
        )
        pos_rows = list(
            (
                await db.execute(
                    select(FinPurchaseOrder).where(
                        FinPurchaseOrder.company_id == company_id, FinPurchaseOrder.capital_item_id == item.id
                    )
                )
            )
            .scalars()
            .all()
        )
        inv_rows = list(
            (
                await db.execute(
                    select(FinInvoice).where(FinInvoice.company_id == company_id, FinInvoice.capital_item_id == item.id)
                )
            )
            .scalars()
            .all()
        )
        out.append(
            {
                **_d(item),
                "position": pos.as_dict(),
                "project_name": project.name if project else None,
                "asset_name": eq.name if eq else None,
                "funding_source_name": funding.name if funding else None,
                "quotes": [_d(q) for q in quotes],
                "purchase_orders": [_d(p) for p in pos_rows],
                "invoices": [_d(i) for i in inv_rows],
                "why": "Live approved / actual / committed / remaining from this capital item's POs and invoices. Linked Pulse project is schedule/tasks — not a second budget.",
            }
        )
    return {"view": view, "dashboard": snap["capital"], "items": out}


async def next_year_builder(db: AsyncSession, company_id: str) -> dict[str, Any]:
    fy = await ensure_defaults(db, company_id)
    assume = await _assumptions(db, company_id, fy)
    snap = await dashboard(db, company_id)
    svc = await service_forecast(db, company_id, fy)
    repl = await replacement_forecast(db, company_id, fy, assume)
    deferred = await deferred_register(db, company_id)
    contracts = await _contract_year_forecast(db, company_id, fy)
    next_year = fy.year + 1
    next_repl = money(repl.get("by_year", {}).get(str(next_year), {}).get("cost") or 0)
    inflated_actuals = inflate(snap["combined"]["actual"], assume.inflation_rate, 1)
    candidates = [
        {
            "label": "Inflated current-year actuals",
            "amount": _f(inflated_actuals),
            "origin": "forecast",
            "why": f"This year's posted actuals × (1 + {assume.inflation_rate}) as a starting operating envelope.",
        },
        {
            "label": "Open commitments expected to carry",
            "amount": snap["combined"]["committed"],
            "origin": "system",
            "why": "Remaining PO balances that may invoice next year if not closed.",
        },
        {
            "label": "Recurring contracts",
            "amount": _f(contracts),
            "origin": "system",
            "why": "Active contract annual_cost overlapping the year.",
        },
        {
            "label": "Preventive maintenance (current year schedule cost)",
            "amount": svc["year_forecast"],
            "origin": "forecast",
            "why": "PM estimated_cost due this year — use as a recurring next-year seed unless you edit the schedule.",
        },
        {
            "label": f"Replacements due {next_year}",
            "amount": _f(next_repl),
            "origin": "forecast",
            "why": "Asset lifecycle replacement year.",
        },
        {
            "label": "Open deferred maintenance",
            "amount": deferred["open_cost"],
            "origin": "user_input",
            "why": "Unfunded register items. Include only if you intend to fund them next year.",
        },
        {
            "label": "Planned capital items starting next year",
            "amount": _f(
                sum(
                    (
                        money(i.estimated_cost)
                        for i in (
                            (
                                await db.execute(
                                    select(FinCapitalItem).where(FinCapitalItem.company_id == company_id)
                                )
                            )
                            .scalars()
                            .all()
                        )
                        if (i.start_year or 0) == next_year
                    ),
                    money(0),
                )
            ),
            "origin": "user_input",
            "why": "Capital items whose start_year is next year.",
        },
    ]
    for c in candidates:
        c["include_in_suggested"] = c["label"] in {
            "Inflated current-year actuals",
            f"Replacements due {next_year}",
            "Open deferred maintenance",
            "Planned capital items starting next year",
        }
        c["why"] = (
            c["why"]
            + (
                " Included in the suggested total."
                if c["include_in_suggested"]
                else " Shown as a source — not added on top of inflated actuals (that would double-count)."
            )
        )
    total = money(sum((money(c["amount"]) for c in candidates if c.get("include_in_suggested")), money(0)))
    return {
        "current_year": fy.year,
        "next_year": next_year,
        "assumptions": _d(assume),
        "candidates": candidates,
        "suggested_total": _f(total),
        "why": "A guided build, not an approved budget. Every line shows its source. Saving a next-year budget still requires an explicit user action.",
        "ai_guard": recommendation_guard("revise_approved"),
    }


async def long_range(db: AsyncSession, company_id: str) -> dict[str, Any]:
    fy = await ensure_defaults(db, company_id)
    assume = await _assumptions(db, company_id, fy)
    repl = await replacement_forecast(db, company_id, fy, assume)
    items = list(
        (await db.execute(select(FinCapitalItem).where(FinCapitalItem.company_id == company_id))).scalars().all()
    )
    years = list(range(fy.year, fy.year + 11))
    matrix: dict[str, dict[str, Any]] = {str(y): {"replacements": 0.0, "capital_items": 0.0, "total": 0.0, "sources": []} for y in years}
    for y, bucket in (repl.get("by_year") or {}).items():
        if y in matrix:
            cost = float(bucket.get("cost") or 0)
            matrix[y]["replacements"] = cost
            matrix[y]["total"] += cost
            matrix[y]["sources"].append({"origin": "forecast", "label": "Asset replacements", "amount": cost})
    for item in items:
        start = item.start_year or fy.year
        end = item.end_year or start
        span = max(1, end - start + 1)
        share = _f(money(item.estimated_cost) / Decimal(span))
        for y in range(start, end + 1):
            key = str(y)
            if key in matrix:
                matrix[key]["capital_items"] += share
                matrix[key]["total"] += share
                matrix[key]["sources"].append(
                    {"origin": "user_input", "label": item.name, "amount": share, "why": "Estimated cost spread across planned years."}
                )
    peak = max(matrix.items(), key=lambda kv: kv[1]["total"]) if matrix else (str(fy.year), {"total": 0})
    funding_rows = list(
        (await db.execute(select(FinFundingSource).where(FinFundingSource.company_id == company_id))).scalars().all()
    )
    funding_total = money(sum((money(f.amount_available) for f in funding_rows), money(0)))
    gaps = []
    for y, v in matrix.items():
        if v["total"] <= 0:
            continue
        named = money(
            sum(
                (
                    money(i.estimated_cost)
                    for i in items
                    if i.funding_source_id
                    and (i.start_year or fy.year) <= int(y) <= (i.end_year or i.start_year or fy.year)
                ),
                money(0),
            )
        )
        gaps.append(
            {
                "year": y,
                "required": v["total"],
                "funding_named": _f(named),
                "gap": _f(money(max(Decimal("0"), money(v["total"]) - named))),
                "why": "Required is replacement + capital items. Named funding is estimated cost on items that already have a funding source. Pulse does not invent a grant.",
            }
        )
    return {
        "years": years,
        "matrix": matrix,
        "peak_year": peak[0],
        "peak_amount": peak[1]["total"],
        "pressure_years": [y for y, v in matrix.items() if v["total"] > 0],
        "funding_available": _f(funding_total),
        "gaps": gaps,
        "assumptions": _d(assume),
        "why": "5–10 year capital pressure from replacement forecasts plus planned capital items. Funding gaps appear where a year has cost and no funding source assigned.",
    }


async def opportunities(db: AsyncSession, company_id: str) -> dict[str, Any]:
    snap = await dashboard(db, company_id)
    available = money(snap["combined"]["available"])
    fy = await ensure_defaults(db, company_id)
    assume = await _assumptions(db, company_id, fy)
    deferred = await deferred_register(db, company_id)
    repl = await replacement_forecast(db, company_id, fy, assume)
    recs: list[dict[str, Any]] = []
    for item in deferred.get("items") or []:
        if item.get("status") != "open":
            continue
        if item.get("regulatory") or item.get("safety") or item.get("risk") in ("high", "critical"):
            recs.append(
                {
                    "kind": "deferred",
                    "title": item["title"],
                    "amount": item["estimated_cost"],
                    "origin": "ai_recommendation",
                    "why": "Open deferred item with regulatory, safety, or high/critical risk. Legitimate need — not a spend instruction.",
                    "href": "/finance/deferred",
                }
            )
    for asset in repl.get("items") or []:
        if asset.get("planned_replacement_year") == fy.year and (asset.get("criticality") in ("high", "critical") or (asset.get("remaining_useful_life_years") or 99) <= 0):
            recs.append(
                {
                    "kind": "replacement",
                    "title": f"Replace {asset['name']}",
                    "amount": asset["replacement_cost_at_year"],
                    "origin": "ai_recommendation",
                    "why": "Replacement year is now and criticality/remaining life supports a legitimate capital need.",
                    "href": "/finance/lifecycle/replacement",
                }
            )
    if not recs:
        recs.append(
            {
                "kind": "none",
                "title": "No spend recommended",
                "amount": 0,
                "origin": "ai_recommendation",
                "why": "Uncommitted remainder is not itself a reason to spend. No condition, regulatory, safety, or replacement trigger met the bar.",
                "href": "/finance/opportunities",
            }
        )
    return {
        "available": _f(available),
        "recommendations": recs,
        "ai_guard": recommendation_guard("purchase"),
        "why": "Opportunities only consume uncommitted remainder against documented needs. The assistant cannot issue a PO or change approved amounts.",
    }


async def assistant_ask(db: AsyncSession, company_id: str, query: str) -> dict[str, Any]:
    snap = await dashboard(db, company_id)
    q = (query or "").strip().lower()
    combined = snap["combined"]
    citations = [
        {"title": "Budget dashboard", "href": "/finance/dashboard", "kind": "calc", "detail": combined["formula"]},
        {"title": "Operating envelope", "href": "/finance/operating/actuals", "kind": "calc", "detail": f"Available {combined['available']}"},
    ]
    if "available" in q or "left" in q or "remaining" in q:
        answer = (
            f"Available is {combined['available']}. "
            f"That is Approved {combined['approved']} − Actual {combined['actual']} − Committed {combined['committed']}. "
            "It is not Approved minus Actual alone."
        )
    elif "commit" in q or "encumber" in q or "po" in q:
        answer = (
            f"Committed (encumbered) is {combined['committed']} from remaining purchase-order balances. "
            "Posting an invoice reduces this and increases Actual so the same dollars are not counted twice."
        )
    elif "replace" in q:
        answer = (
            f"This year's replacement forecast is {snap['upcoming_replacements'].get('this_year_cost') if isinstance(snap.get('upcoming_replacements'), dict) else snap.get('service_forecast')}. "
            "See Asset Lifecycle → Replacement Forecast. Years and costs are calculated from useful life and assumptions — not an AI priority score."
        )
        citations.append({"title": "Replacement forecast", "href": "/finance/lifecycle/replacement", "kind": "forecast"})
    elif "defer" in q:
        answer = (
            f"Open deferred maintenance: {snap['deferred_maintenance']['count']} items, estimated {snap['deferred_maintenance']['cost']}. "
            "Deferring a replacement increases future inflated cost and leaves residual failure risk — see Scenario Planning."
        )
        citations.append({"title": "Deferred maintenance", "href": "/finance/deferred", "kind": "register"})
    else:
        answer = (
            f"Fiscal {snap['fiscal_year']['year']}: approved {combined['approved']}, actual {combined['actual']}, "
            f"committed {combined['committed']}, available {combined['available']}, "
            f"forecast remaining {combined['forecast_remaining']}, projected year-end {combined['projected_year_end']}. "
            "I only use Pulse records and your entries. Missing estimated costs are stated as missing, not invented."
        )
    return {
        "query": query,
        "answer": answer,
        "citations": citations,
        "numbers": combined,
        "disclaimer": "Budget Assistant explains calculations. It cannot purchase, approve spend, modify approved budgets, or create commitments.",
        "ai_guard": recommendation_guard("explain"),
        "origin": "system",
    }


async def generate_justification(
    db: AsyncSession, company_id: str, body: dict[str, Any], *, actor_id: str | None
) -> dict[str, Any]:
    item = None
    if body.get("capital_item_id"):
        item = await _one(db, FinCapitalItem, company_id, body["capital_item_id"])
    eq = None
    if body.get("equipment_id") or (item and item.equipment_id):
        eq = await db.get(FacilityEquipment, body.get("equipment_id") or item.equipment_id)
    title = body.get("title") or (item.name if item else (eq.name if eq else "Capital request"))
    need = body.get("need") or (item.justification if item else "")
    risk = body.get("risk") or ""
    alternatives = body.get("alternatives") or "Repair and defer, or do nothing this year — see Scenario Planning."
    amount = body.get("amount") or (item.estimated_cost if item else 0)
    text = (
        f"CAPITAL JUSTIFICATION\n"
        f"Title: {title}\n"
        f"Estimated / requested: {money(amount)}\n"
        f"Asset: {eq.name if eq else '—'}\n\n"
        f"Need\n{need or 'Describe the service failure or compliance gap. Pulse does not invent this.'}\n\n"
        f"Risk of deferral\n{risk or 'See deferred maintenance and remaining useful life on the asset profile.'}\n\n"
        f"Alternatives considered\n{alternatives}\n\n"
        f"This document is for a manager / finance review. It does not approve spend or create a commitment."
    )
    row = FinCapitalJustification(
        id=_id(),
        company_id=company_id,
        capital_item_id=item.id if item else None,
        equipment_id=eq.id if eq else None,
        title=title,
        body={"need": need, "risk": risk, "alternatives": alternatives, "amount": _f(amount)},
        generated_text=text,
        created_by_user_id=actor_id,
    )
    db.add(row)
    await db.flush()
    return _d(row)


async def reports_csv(db: AsyncSession, company_id: str) -> str:
    snap = await dashboard(db, company_id)
    lines = ["section,metric,amount,origin,why"]
    for key in ("operating", "capital", "combined"):
        pos = snap[key]
        for field, origin in (
            ("approved", "user_input"),
            ("actual", "system"),
            ("committed", "system"),
            ("available", "system"),
            ("forecast_remaining", "forecast"),
            ("projected_year_end", "forecast"),
        ):
            lines.append(f"{key},{field},{pos[field]},{origin},{pos['formula']}")
    for row in snap.get("monthly_actuals") or []:
        lines.append(f"monthly,{row['month']},{row['actual']},system,{row['why']}")
    return "\n".join(lines) + "\n"


# —— CRUD + procurement state machine ——

_CRUD = {
    "funding-sources": FinFundingSource,
    "cost-centres": FinCostCentre,
    "categories": FinExpenseCategory,
    "quotes": FinQuote,
    "invoices": FinInvoice,
    "contracts": FinContract,
    "capital-items": FinCapitalItem,
    "deferred": FinDeferredMaintenance,
    "scenarios": FinScenario,
    "justifications": FinCapitalJustification,
    "budget-lines": FinBudgetLine,
}

_PROTECTED = frozenset({"id", "company_id", "created_at", "updated_at", "remaining_commitment", "issued_at", "posted_at"})


async def list_entity(db: AsyncSession, company_id: str, entity: str) -> list[dict[str, Any]]:
    await ensure_defaults(db, company_id)
    if entity == "purchase-orders":
        rows = list(
            (await db.execute(select(FinPurchaseOrder).where(FinPurchaseOrder.company_id == company_id))).scalars().all()
        )
        return [_d(r) for r in rows]
    if entity == "asset-profiles":
        return await list_asset_profiles(db, company_id)
    if entity == "scenario-options":
        rows = list(
            (await db.execute(select(FinScenarioOption).where(FinScenarioOption.company_id == company_id))).scalars().all()
        )
        return [_d(r) for r in rows]
    if entity == "history":
        rows = list(
            (
                await db.execute(
                    select(FinBudgetHistory)
                    .where(FinBudgetHistory.company_id == company_id)
                    .order_by(FinBudgetHistory.created_at.desc())
                )
            )
            .scalars()
            .all()
        )
        out = []
        for r in rows:
            snap = r.snapshot or {}
            lines = snap.get("lines") or []
            approved = snap.get("approved")
            if approved is None:
                approved = sum((float(x.get("approved_amount") or 0) for x in lines), 0.0)
            out.append(
                {
                    **_d(r),
                    "approved_total": approved,
                    "actual_total": snap.get("actual"),
                    "committed_total": snap.get("committed"),
                    "available_total": snap.get("available"),
                }
            )
        return out
    if entity == "assumptions":
        fy = await ensure_defaults(db, company_id)
        assume = await _assumptions(db, company_id, fy)
        return [_d(assume)]
    if entity == "fiscal-years":
        rows = list((await db.execute(select(FinFiscalYear).where(FinFiscalYear.company_id == company_id))).scalars().all())
        return [_d(r) for r in rows]
    model = _CRUD.get(entity)
    if model is None:
        raise HTTPException(status_code=404, detail="Unknown entity")
    rows = list((await db.execute(select(model).where(model.company_id == company_id))).scalars().all())
    return [_d(r) for r in rows]


def _assign(row: Any, data: dict[str, Any]) -> None:
    for key, val in data.items():
        if key in _PROTECTED or not hasattr(row, key):
            continue
        setattr(row, key, _coerce_field(key, val))


async def create_entity(db: AsyncSession, company_id: str, entity: str, data: dict[str, Any], *, actor_id: str | None) -> dict[str, Any]:
    await ensure_defaults(db, company_id)
    if entity == "purchase-orders":
        return await create_po(db, company_id, data, actor_id=actor_id)
    if entity == "invoices":
        return await create_invoice(db, company_id, data)
    if entity == "scenario-options":
        return await create_scenario_option(db, company_id, data)
    if entity == "asset-profiles":
        return await upsert_asset_profile(db, company_id, data)
    if entity == "assumptions":
        return await update_assumptions(db, company_id, data)
    model = _CRUD.get(entity)
    if model is None:
        raise HTTPException(status_code=404, detail="Unknown entity")
    row = model(id=_id(), company_id=company_id)
    _assign(row, data)
    if hasattr(row, "created_by_user_id") and actor_id:
        row.created_by_user_id = actor_id
    db.add(row)
    await db.flush()
    if entity == "budget-lines":
        await _record_adjustment(db, company_id, row.budget_id, row.id, "created", None, str(row.approved_amount), actor_id)
    return _d(row)


async def patch_entity(db: AsyncSession, company_id: str, entity: str, item_id: str, data: dict[str, Any], *, actor_id: str | None) -> dict[str, Any]:
    if entity == "purchase-orders":
        return await patch_po(db, company_id, item_id, data)
    if entity == "invoices":
        return await patch_invoice(db, company_id, item_id, data)
    if entity == "assumptions":
        return await update_assumptions(db, company_id, data)
    if entity == "asset-profiles":
        data = {**data, "id": item_id}
        return await upsert_asset_profile(db, company_id, data)
    model = _CRUD.get(entity) or (FinScenarioOption if entity == "scenario-options" else None)
    if model is None:
        raise HTTPException(status_code=404, detail="Unknown entity")
    row = await _one(db, model, company_id, item_id)
    if entity == "budget-lines" and "approved_amount" in data:
        await _record_adjustment(
            db, company_id, row.budget_id, row.id, "approved_amount", str(row.approved_amount), str(data["approved_amount"]), actor_id
        )
        await _snapshot_budget(db, company_id, row.budget_id, "REVISED", "Approved line changed", actor_id)
    _assign(row, data)
    await db.flush()
    return _d(row)


async def delete_entity(db: AsyncSession, company_id: str, entity: str, item_id: str) -> None:
    model: type[Any] | None = _CRUD.get(entity)
    if entity == "purchase-orders":
        model = FinPurchaseOrder
    elif entity == "scenario-options":
        model = FinScenarioOption
    elif entity == "asset-profiles":
        model = FinAssetFinancialProfile
    if model is None:
        raise HTTPException(status_code=404, detail="Unknown entity")
    row = await _one(db, model, company_id, item_id)
    await db.delete(row)
    await db.flush()


async def _record_adjustment(
    db: AsyncSession, company_id: str, budget_id: str, line_id: str | None, field: str, old: str | None, new: str | None, actor_id: str | None
) -> None:
    db.add(
        FinBudgetAdjustment(
            id=_id(),
            company_id=company_id,
            budget_id=budget_id,
            line_id=line_id,
            field=field,
            old_value=old,
            new_value=new,
            created_by_user_id=actor_id,
        )
    )


async def _snapshot_budget(db: AsyncSession, company_id: str, budget_id: str, kind: str, note: str, actor_id: str | None) -> None:
    lines = list((await db.execute(select(FinBudgetLine).where(FinBudgetLine.budget_id == budget_id))).scalars().all())
    db.add(
        FinBudgetHistory(
            id=_id(),
            company_id=company_id,
            budget_id=budget_id,
            version_kind=kind,
            snapshot={"lines": [_d(l) for l in lines]},
            note=note,
            created_by_user_id=actor_id,
        )
    )


async def _snapshot_actual_position(db: AsyncSession, company_id: str) -> None:
    """ORIGINAL is never overwritten. Each posted invoice appends an ACTUAL snapshot."""
    fy = await ensure_defaults(db, company_id)
    budgets = await _budgets_for_year(db, company_id, fy.id)
    actual = await _sum_invoices(db, company_id, start=fy.starts_on, end=fy.ends_on)
    committed = await _sum_commitments(db, company_id)
    approved = money(0)
    target: FinBudget | None = next((b for b in budgets if b.kind == "operating"), None)
    for b in budgets:
        approved += await _approved_for_kind(db, [b], b.kind)
    if target is None:
        return
    pos = budget_position(approved=approved, actual=actual, committed=committed, forecast_remaining=0)
    db.add(
        FinBudgetHistory(
            id=_id(),
            company_id=company_id,
            budget_id=target.id,
            version_kind="ACTUAL",
            snapshot={
                "actual": _f(actual),
                "committed": _f(committed),
                "approved": _f(approved),
                "available": _f(pos.available),
                "formula": "available = approved − actual − committed",
            },
            note="Posted invoice — ACTUAL snapshot. ORIGINAL and REVISED rows are kept.",
        )
    )


async def create_po(db: AsyncSession, company_id: str, data: dict[str, Any], *, actor_id: str | None) -> dict[str, Any]:
    year = date.today().year
    n = int(
        (
            await db.execute(
                select(func.count()).select_from(FinPurchaseOrder).where(FinPurchaseOrder.company_id == company_id)
            )
        ).scalar_one()
        or 0
    )
    number = data.get("number") or f"PO-{year}-{n + 1:04d}"
    status = data.get("status") or "draft"
    amount = money(data.get("amount") or 0)
    remaining = money(0)
    issued_at = None
    if status == "issued":
        state = issue_purchase_order(amount)
        remaining = state.remaining_commitment
        issued_at = _now()
    row = FinPurchaseOrder(
        id=_id(),
        company_id=company_id,
        number=number,
        amount=amount,
        remaining_commitment=remaining,
        status=status,
        issued_at=issued_at,
        created_by_user_id=actor_id,
    )
    _assign(row, {k: v for k, v in data.items() if k not in {"amount", "status", "number", "remaining_commitment"}})
    row.amount = amount
    row.status = status
    row.remaining_commitment = remaining
    db.add(row)
    await db.flush()
    return _d(row)


async def patch_po(db: AsyncSession, company_id: str, item_id: str, data: dict[str, Any]) -> dict[str, Any]:
    row = await _one(db, FinPurchaseOrder, company_id, item_id)
    new_status = data.get("status")
    if new_status == "issued" and row.status == "draft":
        state = issue_purchase_order(data.get("amount", row.amount))
        row.amount = state.amount
        row.remaining_commitment = state.remaining_commitment
        row.status = state.status
        row.issued_at = _now()
    elif new_status == "cancelled":
        state = cancel_purchase_order(
            PurchaseOrderState(
                amount=money(row.amount),
                remaining_commitment=money(row.remaining_commitment),
                status=row.status,  # type: ignore[arg-type]
            )
        )
        row.remaining_commitment = state.remaining_commitment
        row.status = state.status
    _assign(row, {k: v for k, v in data.items() if k not in {"status", "remaining_commitment"}})
    if "amount" in data and row.status == "draft":
        row.amount = money(data["amount"])
    await db.flush()
    return _d(row)


async def create_invoice(db: AsyncSession, company_id: str, data: dict[str, Any]) -> dict[str, Any]:
    row = FinInvoice(id=_id(), company_id=company_id, amount=money(data.get("amount") or 0), status=data.get("status") or "draft")
    _assign(row, {k: v for k, v in data.items() if k not in {"amount", "status"}})
    row.amount = money(data.get("amount") or 0)
    db.add(row)
    await db.flush()
    if row.status in POSTED_INVOICE:
        await _post_invoice_effects(db, row)
    return _d(row)


async def patch_invoice(db: AsyncSession, company_id: str, item_id: str, data: dict[str, Any]) -> dict[str, Any]:
    row = await _one(db, FinInvoice, company_id, item_id)
    old_status = row.status
    _assign(row, {k: v for k, v in data.items() if k != "status"})
    if "amount" in data and old_status == "draft":
        row.amount = money(data["amount"])
    new_status = data.get("status", row.status)
    if old_status == "draft" and new_status in POSTED_INVOICE:
        row.status = new_status
        await _post_invoice_effects(db, row)
    elif old_status in POSTED_INVOICE and new_status == "void":
        row.status = "void"
        await _void_invoice_effects(db, row)
    else:
        row.status = new_status
    await db.flush()
    return _d(row)


async def _post_invoice_effects(db: AsyncSession, inv: FinInvoice) -> None:
    po = await db.get(FinPurchaseOrder, inv.po_id) if inv.po_id else None
    from app.core.finance_calc import PurchaseOrderState

    state = None
    if po is not None:
        state = PurchaseOrderState(
            amount=money(po.amount), remaining_commitment=money(po.remaining_commitment), status=po.status  # type: ignore[arg-type]
        )
    _, updated = apply_posted_invoice(state, inv.amount)
    if po is not None and updated is not None:
        po.remaining_commitment = updated.remaining_commitment
        po.status = updated.status
    inv.posted_at = _now()
    if inv.status == "paid" and inv.paid_at is None:
        inv.paid_at = _now()
    await _snapshot_actual_position(db, inv.company_id)


async def _void_invoice_effects(db: AsyncSession, inv: FinInvoice) -> None:
    po = await db.get(FinPurchaseOrder, inv.po_id) if inv.po_id else None
    from app.core.finance_calc import PurchaseOrderState

    state = None
    if po is not None:
        state = PurchaseOrderState(
            amount=money(po.amount), remaining_commitment=money(po.remaining_commitment), status=po.status  # type: ignore[arg-type]
        )
    _, updated = void_posted_invoice(state, inv.amount)
    if po is not None and updated is not None:
        po.remaining_commitment = updated.remaining_commitment
        po.status = updated.status


async def create_scenario_option(db: AsyncSession, company_id: str, data: dict[str, Any]) -> dict[str, Any]:
    fy = await ensure_defaults(db, company_id)
    assume = await _assumptions(db, company_id, fy)
    kind = data.get("option_kind") or "replace_now"
    cons = scenario_consequence(
        kind=kind,
        replacement_cost_now=data.get("estimated_cost") or 0,
        repair_cost=data.get("repair_cost") or 0,
        annual_maintenance=data.get("annual_maintenance") or 0,
        inflation_rate=assume.inflation_rate,
        risk_note=data.get("risk_note"),
    )
    row = FinScenarioOption(
        id=_id(),
        company_id=company_id,
        scenario_id=data["scenario_id"],
        equipment_id=data.get("equipment_id"),
        option_kind=kind,
        estimated_cost=money(cons["estimated_cost"]),
        year=data.get("year"),
        risk_note=data.get("risk_note"),
        consequences=cons,
    )
    db.add(row)
    await db.flush()
    return _d(row)


async def list_asset_profiles(db: AsyncSession, company_id: str) -> list[dict[str, Any]]:
    fy = await ensure_defaults(db, company_id)
    assume = await _assumptions(db, company_id, fy)
    repl = await replacement_forecast(db, company_id, fy, assume)
    return repl["items"]


async def upsert_asset_profile(db: AsyncSession, company_id: str, data: dict[str, Any]) -> dict[str, Any]:
    eq_id = data.get("equipment_id")
    if not eq_id:
        raise HTTPException(status_code=400, detail="equipment_id required")
    eq = await db.get(FacilityEquipment, eq_id)
    if eq is None or str(eq.company_id) != company_id:
        raise HTTPException(status_code=404, detail="Asset not found")
    row = (
        await db.execute(
            select(FinAssetFinancialProfile).where(
                FinAssetFinancialProfile.company_id == company_id,
                FinAssetFinancialProfile.equipment_id == eq_id,
            )
        )
    ).scalar_one_or_none()
    if row is None:
        row = FinAssetFinancialProfile(id=_id(), company_id=company_id, equipment_id=eq_id)
        db.add(row)
    _assign(row, data)
    await db.flush()
    fy = await ensure_defaults(db, company_id)
    assume = await _assumptions(db, company_id, fy)
    calc = asset_lifecycle(
        as_of=date.today(),
        acquisition_date=row.acquisition_date,
        installation_date=eq.installation_date,
        useful_life_years=row.useful_life_years,
        acquisition_cost=row.acquisition_cost,
        replacement_value=row.replacement_value,
        planned_replacement_year=row.planned_replacement_year,
        planned_replacement_cost=row.planned_replacement_cost,
        maintenance_cost_to_date=row.maintenance_cost_to_date,
        inflation_rate=row.inflation_override if row.inflation_override is not None else assume.inflation_rate,
        contingency_rate=row.contingency_override if row.contingency_override is not None else assume.contingency_rate,
        condition=row.condition,
        criticality=row.criticality,
    )
    return {**_d(row), **calc.as_dict(), "name": eq.name}


async def update_assumptions(db: AsyncSession, company_id: str, data: dict[str, Any]) -> dict[str, Any]:
    fy = await ensure_defaults(db, company_id)
    row = await _assumptions(db, company_id, fy)
    _assign(row, data)
    await db.flush()
    return _d(row)


async def compare_scenarios(db: AsyncSession, company_id: str) -> dict[str, Any]:
    opts = list(
        (await db.execute(select(FinScenarioOption).where(FinScenarioOption.company_id == company_id))).scalars().all()
    )
    scenarios = {s.id: s for s in (await db.execute(select(FinScenario).where(FinScenario.company_id == company_id))).scalars().all()}
    rows = []
    for o in opts:
        eq = await db.get(FacilityEquipment, o.equipment_id) if o.equipment_id else None
        rows.append(
            {
                **_d(o),
                "asset": eq.name if eq else None,
                "scenario": scenarios[o.scenario_id].name if o.scenario_id in scenarios else None,
            }
        )
    return {
        "rows": rows,
        "why": "Structured compare only. Pulse does not pick an option. Costs are stored consequences from the selected replace / repair / defer path.",
    }
