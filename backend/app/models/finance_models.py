"""Financial & Asset Planning — tenant-scoped municipal budget records.

Assets themselves stay on facility_equipment. This module stores the financial
profile, budgets, procurement commitments, and planning artefacts that hang off
those existing assets / projects / PM tasks / work requests.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


def _uuid() -> str:
    return str(uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


Money = Numeric(14, 2)


class FinFiscalYear(Base):
    __tablename__ = "fin_fiscal_years"
    __table_args__ = (UniqueConstraint("company_id", "year", name="uq_fin_fiscal_years_company_year"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    starts_on: Mapped[date] = mapped_column(Date, nullable=False)
    ends_on: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="open", server_default="open")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)


class FinCostCentre(Base):
    __tablename__ = "fin_cost_centres"
    __table_args__ = (UniqueConstraint("company_id", "code", name="uq_fin_cost_centres_company_code"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    department: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    facility_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("ops_facilities.id", ondelete="SET NULL"), nullable=True, index=True
    )
    gl_account: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)


class FinFundingSource(Base):
    __tablename__ = "fin_funding_sources"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    kind: Mapped[str] = mapped_column(String(64), nullable=False, default="taxation", server_default="taxation")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    amount_available: Mapped[Optional[Decimal]] = mapped_column(Money, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)


class FinExpenseCategory(Base):
    __tablename__ = "fin_expense_categories"
    __table_args__ = (UniqueConstraint("company_id", "code", name="uq_fin_expense_categories_company_code"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    kind: Mapped[str] = mapped_column(String(16), nullable=False, default="operating")
    parent_code: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)


class FinBudgetAssumption(Base):
    __tablename__ = "fin_budget_assumptions"
    __table_args__ = (UniqueConstraint("company_id", "fiscal_year_id", name="uq_fin_budget_assumptions_year"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    fiscal_year_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("fin_fiscal_years.id", ondelete="CASCADE"), nullable=False, index=True
    )
    inflation_rate: Mapped[Decimal] = mapped_column(Numeric(8, 4), nullable=False, default=Decimal("0.0300"))
    contingency_rate: Mapped[Decimal] = mapped_column(Numeric(8, 4), nullable=False, default=Decimal("0.1000"))
    source: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    as_of: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    vendor: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)


class FinBudget(Base):
    __tablename__ = "fin_budgets"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    fiscal_year_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("fin_fiscal_years.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft", server_default="draft")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)


class FinBudgetLine(Base):
    __tablename__ = "fin_budget_lines"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    budget_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("fin_budgets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("fin_expense_categories.id", ondelete="SET NULL"), nullable=True, index=True
    )
    cost_centre_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("fin_cost_centres.id", ondelete="SET NULL"), nullable=True, index=True
    )
    funding_source_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("fin_funding_sources.id", ondelete="SET NULL"), nullable=True
    )
    facility_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("ops_facilities.id", ondelete="SET NULL"), nullable=True
    )
    program: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    asset_category: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    gl_account: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    approved_amount: Mapped[Decimal] = mapped_column(Money, nullable=False, default=Decimal("0"), server_default="0")
    forecast_amount: Mapped[Decimal] = mapped_column(Money, nullable=False, default=Decimal("0"), server_default="0")
    source_kind: Mapped[str] = mapped_column(String(32), nullable=False, default="user_input", server_default="user_input")
    source_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)


class FinBudgetHistory(Base):
    __tablename__ = "fin_budget_history"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    budget_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("fin_budgets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version_kind: Mapped[str] = mapped_column(String(16), nullable=False)
    snapshot: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class FinBudgetAdjustment(Base):
    __tablename__ = "fin_budget_adjustments"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    budget_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("fin_budgets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    line_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("fin_budget_lines.id", ondelete="SET NULL"), nullable=True
    )
    field: Mapped[str] = mapped_column(String(64), nullable=False)
    old_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    new_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class FinQuote(Base):
    __tablename__ = "fin_quotes"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    vendor_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("inventory_vendors.id", ondelete="SET NULL"), nullable=True
    )
    vendor_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    amount: Mapped[Decimal] = mapped_column(Money, nullable=False, default=Decimal("0"), server_default="0")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft", server_default="draft")
    budget_line_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("fin_budget_lines.id", ondelete="SET NULL"), nullable=True
    )
    equipment_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("facility_equipment.id", ondelete="SET NULL"), nullable=True, index=True
    )
    capital_item_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("fin_capital_items.id", ondelete="SET NULL"), nullable=True, index=True
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)


class FinPurchaseOrder(Base):
    __tablename__ = "fin_purchase_orders"
    __table_args__ = (UniqueConstraint("company_id", "number", name="uq_fin_purchase_orders_company_number"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    number: Mapped[str] = mapped_column(String(64), nullable=False)
    quote_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("fin_quotes.id", ondelete="SET NULL"), nullable=True
    )
    vendor_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("inventory_vendors.id", ondelete="SET NULL"), nullable=True
    )
    vendor_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    amount: Mapped[Decimal] = mapped_column(Money, nullable=False, default=Decimal("0"), server_default="0")
    remaining_commitment: Mapped[Decimal] = mapped_column(Money, nullable=False, default=Decimal("0"), server_default="0")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft", server_default="draft")
    budget_line_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("fin_budget_lines.id", ondelete="SET NULL"), nullable=True, index=True
    )
    equipment_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("facility_equipment.id", ondelete="SET NULL"), nullable=True, index=True
    )
    capital_item_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("fin_capital_items.id", ondelete="SET NULL"), nullable=True, index=True
    )
    project_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("pulse_projects.id", ondelete="SET NULL"), nullable=True, index=True
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    issued_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)


class FinInvoice(Base):
    __tablename__ = "fin_invoices"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    number: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    po_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("fin_purchase_orders.id", ondelete="SET NULL"), nullable=True, index=True
    )
    vendor_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    amount: Mapped[Decimal] = mapped_column(Money, nullable=False, default=Decimal("0"), server_default="0")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft", server_default="draft")
    budget_line_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("fin_budget_lines.id", ondelete="SET NULL"), nullable=True, index=True
    )
    equipment_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("facility_equipment.id", ondelete="SET NULL"), nullable=True, index=True
    )
    capital_item_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("fin_capital_items.id", ondelete="SET NULL"), nullable=True, index=True
    )
    invoice_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    posted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)


class FinContract(Base):
    __tablename__ = "fin_contracts"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    vendor_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    vendor_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("inventory_vendors.id", ondelete="SET NULL"), nullable=True
    )
    annual_cost: Mapped[Decimal] = mapped_column(Money, nullable=False, default=Decimal("0"), server_default="0")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active", server_default="active")
    starts_on: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    ends_on: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    renewal_on: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    budget_line_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("fin_budget_lines.id", ondelete="SET NULL"), nullable=True
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)


class FinCapitalItem(Base):
    __tablename__ = "fin_capital_items"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(32), nullable=False, default="project")
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    project_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("pulse_projects.id", ondelete="SET NULL"), nullable=True, index=True
    )
    equipment_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("facility_equipment.id", ondelete="SET NULL"), nullable=True, index=True
    )
    budget_line_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("fin_budget_lines.id", ondelete="SET NULL"), nullable=True
    )
    funding_source_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("fin_funding_sources.id", ondelete="SET NULL"), nullable=True
    )
    estimated_cost: Mapped[Decimal] = mapped_column(Money, nullable=False, default=Decimal("0"), server_default="0")
    approved_amount: Mapped[Decimal] = mapped_column(Money, nullable=False, default=Decimal("0"), server_default="0")
    start_year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    end_year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    priority: Mapped[str] = mapped_column(String(16), nullable=False, default="medium", server_default="medium")
    justification: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    pm_impact: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="planned", server_default="planned")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)


class FinAssetFinancialProfile(Base):
    __tablename__ = "fin_asset_financial_profiles"
    __table_args__ = (UniqueConstraint("company_id", "equipment_id", name="uq_fin_asset_profile_equipment"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    equipment_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("facility_equipment.id", ondelete="CASCADE"), nullable=False, index=True
    )
    acquisition_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    acquisition_cost: Mapped[Optional[Decimal]] = mapped_column(Money, nullable=True)
    replacement_value: Mapped[Optional[Decimal]] = mapped_column(Money, nullable=True)
    useful_life_years: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    condition: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    criticality: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    planned_replacement_year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    planned_replacement_cost: Mapped[Optional[Decimal]] = mapped_column(Money, nullable=True)
    inflation_override: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4), nullable=True)
    contingency_override: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4), nullable=True)
    maintenance_cost_to_date: Mapped[Optional[Decimal]] = mapped_column(Money, nullable=True)
    last_failure_cost: Mapped[Optional[Decimal]] = mapped_column(Money, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)


class FinDeferredMaintenance(Base):
    __tablename__ = "fin_deferred_maintenance"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    equipment_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("facility_equipment.id", ondelete="SET NULL"), nullable=True, index=True
    )
    work_request_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("pulse_work_requests.id", ondelete="SET NULL"), nullable=True, index=True
    )
    estimated_cost: Mapped[Decimal] = mapped_column(Money, nullable=False, default=Decimal("0"), server_default="0")
    risk: Mapped[str] = mapped_column(String(16), nullable=False, default="medium", server_default="medium")
    regulatory: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    safety: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="open", server_default="open")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)


class FinScenario(Base):
    __tablename__ = "fin_scenarios"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)


class FinScenarioOption(Base):
    __tablename__ = "fin_scenario_options"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    scenario_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("fin_scenarios.id", ondelete="CASCADE"), nullable=False, index=True
    )
    equipment_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("facility_equipment.id", ondelete="SET NULL"), nullable=True, index=True
    )
    option_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    estimated_cost: Mapped[Decimal] = mapped_column(Money, nullable=False, default=Decimal("0"), server_default="0")
    year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    risk_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    consequences: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)


class FinCapitalJustification(Base):
    __tablename__ = "fin_capital_justifications"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    capital_item_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("fin_capital_items.id", ondelete="SET NULL"), nullable=True
    )
    equipment_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("facility_equipment.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    generated_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_by_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)
