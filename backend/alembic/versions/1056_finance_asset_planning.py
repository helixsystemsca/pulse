"""Financial & Asset Planning tables, PM estimated cost, and tenant RLS."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import JSONB, UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1056_finance_asset_planning"
down_revision = "1055_facility_links"
branch_labels = None
depends_on = None

_TABLES = (
    "fin_fiscal_years",
    "fin_cost_centres",
    "fin_funding_sources",
    "fin_expense_categories",
    "fin_budget_assumptions",
    "fin_budgets",
    "fin_budget_lines",
    "fin_budget_history",
    "fin_budget_adjustments",
    "fin_capital_items",
    "fin_quotes",
    "fin_purchase_orders",
    "fin_invoices",
    "fin_contracts",
    "fin_asset_financial_profiles",
    "fin_deferred_maintenance",
    "fin_scenarios",
    "fin_scenario_options",
    "fin_capital_justifications",
)

_USING = "public.pulse_rls_is_system_admin() OR public.pulse_rls_tenant_visible(company_id)"


def _money() -> sa.Numeric:
    return sa.Numeric(14, 2)


def _uuid_pk() -> sa.Column:
    return sa.Column("id", UUID(as_uuid=False), primary_key=True)


def _company() -> sa.Column:
    return sa.Column(
        "company_id",
        UUID(as_uuid=False),
        sa.ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
    )


def _ts() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    ]


def _apply_rls(conn, table: str) -> None:
    q = f'"{table}"'
    conn.execute(text(f"ALTER TABLE {q} ENABLE ROW LEVEL SECURITY"))
    conn.execute(text(f"ALTER TABLE {q} FORCE ROW LEVEL SECURITY"))
    names = {
        "select": f"pulse_rls_{table}_select",
        "insert": f"pulse_rls_{table}_insert",
        "update": f"pulse_rls_{table}_update",
        "delete": f"pulse_rls_{table}_delete",
    }
    for pol in names.values():
        conn.execute(text(f'DROP POLICY IF EXISTS "{pol}" ON {q}'))
    conn.execute(text(f'CREATE POLICY "{names["select"]}" ON {q} FOR SELECT USING ({_USING})'))
    conn.execute(text(f'CREATE POLICY "{names["insert"]}" ON {q} FOR INSERT WITH CHECK ({_USING})'))
    conn.execute(
        text(f'CREATE POLICY "{names["update"]}" ON {q} FOR UPDATE USING ({_USING}) WITH CHECK ({_USING})')
    )
    conn.execute(text(f'CREATE POLICY "{names["delete"]}" ON {q} FOR DELETE USING ({_USING})'))


def upgrade() -> None:
    conn = op.get_bind()

    ah.safe_add_column(
        op,
        conn,
        "pm_tasks",
        sa.Column("estimated_cost", _money(), nullable=True),
    )

    ah.safe_create_table(
        op,
        conn,
        "fin_fiscal_years",
        _uuid_pk(),
        _company(),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("starts_on", sa.Date(), nullable=False),
        sa.Column("ends_on", sa.Date(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="open"),
        *_ts(),
        sa.UniqueConstraint("company_id", "year", name="uq_fin_fiscal_years_company_year"),
    )
    ah.safe_create_index(op, conn, "ix_fin_fiscal_years_company_id", "fin_fiscal_years", ["company_id"])

    ah.safe_create_table(
        op,
        conn,
        "fin_cost_centres",
        _uuid_pk(),
        _company(),
        sa.Column("code", sa.String(64), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("department", sa.String(128), nullable=True),
        sa.Column("facility_id", UUID(as_uuid=False), sa.ForeignKey("ops_facilities.id", ondelete="SET NULL"), nullable=True),
        sa.Column("gl_account", sa.String(64), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        *_ts(),
        sa.UniqueConstraint("company_id", "code", name="uq_fin_cost_centres_company_code"),
    )
    ah.safe_create_index(op, conn, "ix_fin_cost_centres_company_id", "fin_cost_centres", ["company_id"])

    ah.safe_create_table(
        op,
        conn,
        "fin_funding_sources",
        _uuid_pk(),
        _company(),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("kind", sa.String(64), nullable=False, server_default="taxation"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("amount_available", _money(), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        *_ts(),
    )
    ah.safe_create_index(op, conn, "ix_fin_funding_sources_company_id", "fin_funding_sources", ["company_id"])

    ah.safe_create_table(
        op,
        conn,
        "fin_expense_categories",
        _uuid_pk(),
        _company(),
        sa.Column("code", sa.String(64), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False, server_default="operating"),
        sa.Column("parent_code", sa.String(64), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        *_ts(),
        sa.UniqueConstraint("company_id", "code", name="uq_fin_expense_categories_company_code"),
    )
    ah.safe_create_index(op, conn, "ix_fin_expense_categories_company_id", "fin_expense_categories", ["company_id"])

    ah.safe_create_table(
        op,
        conn,
        "fin_budgets",
        _uuid_pk(),
        _company(),
        sa.Column("fiscal_year_id", UUID(as_uuid=False), sa.ForeignKey("fin_fiscal_years.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="draft"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by_user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        *_ts(),
    )
    ah.safe_create_index(op, conn, "ix_fin_budgets_company_id", "fin_budgets", ["company_id"])
    ah.safe_create_index(op, conn, "ix_fin_budgets_fiscal_year_id", "fin_budgets", ["fiscal_year_id"])

    ah.safe_create_table(
        op,
        conn,
        "fin_budget_assumptions",
        _uuid_pk(),
        _company(),
        sa.Column("fiscal_year_id", UUID(as_uuid=False), sa.ForeignKey("fin_fiscal_years.id", ondelete="CASCADE"), nullable=False),
        sa.Column("inflation_rate", sa.Numeric(8, 4), nullable=False, server_default="0.0300"),
        sa.Column("contingency_rate", sa.Numeric(8, 4), nullable=False, server_default="0.1000"),
        sa.Column("source", sa.String(255), nullable=True),
        sa.Column("as_of", sa.Date(), nullable=True),
        sa.Column("vendor", sa.String(255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        *_ts(),
        sa.UniqueConstraint("company_id", "fiscal_year_id", name="uq_fin_budget_assumptions_year"),
    )
    ah.safe_create_index(op, conn, "ix_fin_budget_assumptions_company_id", "fin_budget_assumptions", ["company_id"])
    ah.safe_create_index(op, conn, "ix_fin_budget_assumptions_fiscal_year_id", "fin_budget_assumptions", ["fiscal_year_id"])

    ah.safe_create_table(
        op,
        conn,
        "fin_budget_lines",
        _uuid_pk(),
        _company(),
        sa.Column("budget_id", UUID(as_uuid=False), sa.ForeignKey("fin_budgets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category_id", UUID(as_uuid=False), sa.ForeignKey("fin_expense_categories.id", ondelete="SET NULL"), nullable=True),
        sa.Column("cost_centre_id", UUID(as_uuid=False), sa.ForeignKey("fin_cost_centres.id", ondelete="SET NULL"), nullable=True),
        sa.Column("funding_source_id", UUID(as_uuid=False), sa.ForeignKey("fin_funding_sources.id", ondelete="SET NULL"), nullable=True),
        sa.Column("facility_id", UUID(as_uuid=False), sa.ForeignKey("ops_facilities.id", ondelete="SET NULL"), nullable=True),
        sa.Column("program", sa.String(128), nullable=True),
        sa.Column("asset_category", sa.String(128), nullable=True),
        sa.Column("gl_account", sa.String(64), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("approved_amount", _money(), nullable=False, server_default="0"),
        sa.Column("forecast_amount", _money(), nullable=False, server_default="0"),
        sa.Column("source_kind", sa.String(32), nullable=False, server_default="user_input"),
        sa.Column("source_note", sa.Text(), nullable=True),
        *_ts(),
    )
    ah.safe_create_index(op, conn, "ix_fin_budget_lines_company_id", "fin_budget_lines", ["company_id"])
    ah.safe_create_index(op, conn, "ix_fin_budget_lines_budget_id", "fin_budget_lines", ["budget_id"])

    ah.safe_create_table(
        op,
        conn,
        "fin_budget_history",
        _uuid_pk(),
        _company(),
        sa.Column("budget_id", UUID(as_uuid=False), sa.ForeignKey("fin_budgets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version_kind", sa.String(16), nullable=False),
        sa.Column("snapshot", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_by_user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    ah.safe_create_index(op, conn, "ix_fin_budget_history_company_id", "fin_budget_history", ["company_id"])
    ah.safe_create_index(op, conn, "ix_fin_budget_history_budget_id", "fin_budget_history", ["budget_id"])

    ah.safe_create_table(
        op,
        conn,
        "fin_budget_adjustments",
        _uuid_pk(),
        _company(),
        sa.Column("budget_id", UUID(as_uuid=False), sa.ForeignKey("fin_budgets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("line_id", UUID(as_uuid=False), sa.ForeignKey("fin_budget_lines.id", ondelete="SET NULL"), nullable=True),
        sa.Column("field", sa.String(64), nullable=False),
        sa.Column("old_value", sa.Text(), nullable=True),
        sa.Column("new_value", sa.Text(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("created_by_user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    ah.safe_create_index(op, conn, "ix_fin_budget_adjustments_company_id", "fin_budget_adjustments", ["company_id"])
    ah.safe_create_index(op, conn, "ix_fin_budget_adjustments_budget_id", "fin_budget_adjustments", ["budget_id"])

    ah.safe_create_table(
        op,
        conn,
        "fin_capital_items",
        _uuid_pk(),
        _company(),
        sa.Column("kind", sa.String(32), nullable=False, server_default="project"),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("project_id", UUID(as_uuid=False), sa.ForeignKey("pulse_projects.id", ondelete="SET NULL"), nullable=True),
        sa.Column("equipment_id", UUID(as_uuid=False), sa.ForeignKey("facility_equipment.id", ondelete="SET NULL"), nullable=True),
        sa.Column("budget_line_id", UUID(as_uuid=False), sa.ForeignKey("fin_budget_lines.id", ondelete="SET NULL"), nullable=True),
        sa.Column("funding_source_id", UUID(as_uuid=False), sa.ForeignKey("fin_funding_sources.id", ondelete="SET NULL"), nullable=True),
        sa.Column("estimated_cost", _money(), nullable=False, server_default="0"),
        sa.Column("approved_amount", _money(), nullable=False, server_default="0"),
        sa.Column("start_year", sa.Integer(), nullable=True),
        sa.Column("end_year", sa.Integer(), nullable=True),
        sa.Column("priority", sa.String(16), nullable=False, server_default="medium"),
        sa.Column("justification", sa.Text(), nullable=True),
        sa.Column("pm_impact", sa.Text(), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="planned"),
        *_ts(),
    )
    ah.safe_create_index(op, conn, "ix_fin_capital_items_company_id", "fin_capital_items", ["company_id"])
    ah.safe_create_index(op, conn, "ix_fin_capital_items_project_id", "fin_capital_items", ["project_id"])
    ah.safe_create_index(op, conn, "ix_fin_capital_items_equipment_id", "fin_capital_items", ["equipment_id"])

    ah.safe_create_table(
        op,
        conn,
        "fin_quotes",
        _uuid_pk(),
        _company(),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("vendor_id", UUID(as_uuid=False), sa.ForeignKey("inventory_vendors.id", ondelete="SET NULL"), nullable=True),
        sa.Column("vendor_name", sa.String(255), nullable=True),
        sa.Column("amount", _money(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(16), nullable=False, server_default="draft"),
        sa.Column("budget_line_id", UUID(as_uuid=False), sa.ForeignKey("fin_budget_lines.id", ondelete="SET NULL"), nullable=True),
        sa.Column("equipment_id", UUID(as_uuid=False), sa.ForeignKey("facility_equipment.id", ondelete="SET NULL"), nullable=True),
        sa.Column("capital_item_id", UUID(as_uuid=False), sa.ForeignKey("fin_capital_items.id", ondelete="SET NULL"), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        *_ts(),
    )
    ah.safe_create_index(op, conn, "ix_fin_quotes_company_id", "fin_quotes", ["company_id"])
    ah.safe_create_index(op, conn, "ix_fin_quotes_equipment_id", "fin_quotes", ["equipment_id"])

    ah.safe_create_table(
        op,
        conn,
        "fin_purchase_orders",
        _uuid_pk(),
        _company(),
        sa.Column("number", sa.String(64), nullable=False),
        sa.Column("quote_id", UUID(as_uuid=False), sa.ForeignKey("fin_quotes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("vendor_id", UUID(as_uuid=False), sa.ForeignKey("inventory_vendors.id", ondelete="SET NULL"), nullable=True),
        sa.Column("vendor_name", sa.String(255), nullable=True),
        sa.Column("amount", _money(), nullable=False, server_default="0"),
        sa.Column("remaining_commitment", _money(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(16), nullable=False, server_default="draft"),
        sa.Column("budget_line_id", UUID(as_uuid=False), sa.ForeignKey("fin_budget_lines.id", ondelete="SET NULL"), nullable=True),
        sa.Column("equipment_id", UUID(as_uuid=False), sa.ForeignKey("facility_equipment.id", ondelete="SET NULL"), nullable=True),
        sa.Column("capital_item_id", UUID(as_uuid=False), sa.ForeignKey("fin_capital_items.id", ondelete="SET NULL"), nullable=True),
        sa.Column("project_id", UUID(as_uuid=False), sa.ForeignKey("pulse_projects.id", ondelete="SET NULL"), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by_user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        *_ts(),
        sa.UniqueConstraint("company_id", "number", name="uq_fin_purchase_orders_company_number"),
    )
    ah.safe_create_index(op, conn, "ix_fin_purchase_orders_company_id", "fin_purchase_orders", ["company_id"])
    ah.safe_create_index(op, conn, "ix_fin_purchase_orders_budget_line_id", "fin_purchase_orders", ["budget_line_id"])
    ah.safe_create_index(op, conn, "ix_fin_purchase_orders_equipment_id", "fin_purchase_orders", ["equipment_id"])
    ah.safe_create_index(op, conn, "ix_fin_purchase_orders_project_id", "fin_purchase_orders", ["project_id"])

    ah.safe_create_table(
        op,
        conn,
        "fin_invoices",
        _uuid_pk(),
        _company(),
        sa.Column("number", sa.String(64), nullable=True),
        sa.Column("po_id", UUID(as_uuid=False), sa.ForeignKey("fin_purchase_orders.id", ondelete="SET NULL"), nullable=True),
        sa.Column("vendor_name", sa.String(255), nullable=True),
        sa.Column("amount", _money(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(16), nullable=False, server_default="draft"),
        sa.Column("budget_line_id", UUID(as_uuid=False), sa.ForeignKey("fin_budget_lines.id", ondelete="SET NULL"), nullable=True),
        sa.Column("equipment_id", UUID(as_uuid=False), sa.ForeignKey("facility_equipment.id", ondelete="SET NULL"), nullable=True),
        sa.Column("capital_item_id", UUID(as_uuid=False), sa.ForeignKey("fin_capital_items.id", ondelete="SET NULL"), nullable=True),
        sa.Column("invoice_date", sa.Date(), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("posted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        *_ts(),
    )
    ah.safe_create_index(op, conn, "ix_fin_invoices_company_id", "fin_invoices", ["company_id"])
    ah.safe_create_index(op, conn, "ix_fin_invoices_po_id", "fin_invoices", ["po_id"])
    ah.safe_create_index(op, conn, "ix_fin_invoices_budget_line_id", "fin_invoices", ["budget_line_id"])
    ah.safe_create_index(op, conn, "ix_fin_invoices_equipment_id", "fin_invoices", ["equipment_id"])

    ah.safe_create_table(
        op,
        conn,
        "fin_contracts",
        _uuid_pk(),
        _company(),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("vendor_name", sa.String(255), nullable=True),
        sa.Column("vendor_id", UUID(as_uuid=False), sa.ForeignKey("inventory_vendors.id", ondelete="SET NULL"), nullable=True),
        sa.Column("annual_cost", _money(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(16), nullable=False, server_default="active"),
        sa.Column("starts_on", sa.Date(), nullable=True),
        sa.Column("ends_on", sa.Date(), nullable=True),
        sa.Column("renewal_on", sa.Date(), nullable=True),
        sa.Column("budget_line_id", UUID(as_uuid=False), sa.ForeignKey("fin_budget_lines.id", ondelete="SET NULL"), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        *_ts(),
    )
    ah.safe_create_index(op, conn, "ix_fin_contracts_company_id", "fin_contracts", ["company_id"])

    ah.safe_create_table(
        op,
        conn,
        "fin_asset_financial_profiles",
        _uuid_pk(),
        _company(),
        sa.Column("equipment_id", UUID(as_uuid=False), sa.ForeignKey("facility_equipment.id", ondelete="CASCADE"), nullable=False),
        sa.Column("acquisition_date", sa.Date(), nullable=True),
        sa.Column("acquisition_cost", _money(), nullable=True),
        sa.Column("replacement_value", _money(), nullable=True),
        sa.Column("useful_life_years", sa.Integer(), nullable=True),
        sa.Column("condition", sa.String(32), nullable=True),
        sa.Column("criticality", sa.String(32), nullable=True),
        sa.Column("planned_replacement_year", sa.Integer(), nullable=True),
        sa.Column("planned_replacement_cost", _money(), nullable=True),
        sa.Column("inflation_override", sa.Numeric(8, 4), nullable=True),
        sa.Column("contingency_override", sa.Numeric(8, 4), nullable=True),
        sa.Column("maintenance_cost_to_date", _money(), nullable=True),
        sa.Column("last_failure_cost", _money(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        *_ts(),
        sa.UniqueConstraint("company_id", "equipment_id", name="uq_fin_asset_profile_equipment"),
    )
    ah.safe_create_index(op, conn, "ix_fin_asset_financial_profiles_company_id", "fin_asset_financial_profiles", ["company_id"])
    ah.safe_create_index(op, conn, "ix_fin_asset_financial_profiles_equipment_id", "fin_asset_financial_profiles", ["equipment_id"])

    ah.safe_create_table(
        op,
        conn,
        "fin_deferred_maintenance",
        _uuid_pk(),
        _company(),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("equipment_id", UUID(as_uuid=False), sa.ForeignKey("facility_equipment.id", ondelete="SET NULL"), nullable=True),
        sa.Column("work_request_id", UUID(as_uuid=False), sa.ForeignKey("pulse_work_requests.id", ondelete="SET NULL"), nullable=True),
        sa.Column("estimated_cost", _money(), nullable=False, server_default="0"),
        sa.Column("risk", sa.String(16), nullable=False, server_default="medium"),
        sa.Column("regulatory", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("safety", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("status", sa.String(16), nullable=False, server_default="open"),
        sa.Column("notes", sa.Text(), nullable=True),
        *_ts(),
    )
    ah.safe_create_index(op, conn, "ix_fin_deferred_maintenance_company_id", "fin_deferred_maintenance", ["company_id"])
    ah.safe_create_index(op, conn, "ix_fin_deferred_maintenance_equipment_id", "fin_deferred_maintenance", ["equipment_id"])
    ah.safe_create_index(op, conn, "ix_fin_deferred_maintenance_work_request_id", "fin_deferred_maintenance", ["work_request_id"])

    ah.safe_create_table(
        op,
        conn,
        "fin_scenarios",
        _uuid_pk(),
        _company(),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        *_ts(),
    )
    ah.safe_create_index(op, conn, "ix_fin_scenarios_company_id", "fin_scenarios", ["company_id"])

    ah.safe_create_table(
        op,
        conn,
        "fin_scenario_options",
        _uuid_pk(),
        _company(),
        sa.Column("scenario_id", UUID(as_uuid=False), sa.ForeignKey("fin_scenarios.id", ondelete="CASCADE"), nullable=False),
        sa.Column("equipment_id", UUID(as_uuid=False), sa.ForeignKey("facility_equipment.id", ondelete="SET NULL"), nullable=True),
        sa.Column("option_kind", sa.String(32), nullable=False),
        sa.Column("estimated_cost", _money(), nullable=False, server_default="0"),
        sa.Column("year", sa.Integer(), nullable=True),
        sa.Column("risk_note", sa.Text(), nullable=True),
        sa.Column("consequences", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        *_ts(),
    )
    ah.safe_create_index(op, conn, "ix_fin_scenario_options_company_id", "fin_scenario_options", ["company_id"])
    ah.safe_create_index(op, conn, "ix_fin_scenario_options_scenario_id", "fin_scenario_options", ["scenario_id"])
    ah.safe_create_index(op, conn, "ix_fin_scenario_options_equipment_id", "fin_scenario_options", ["equipment_id"])

    ah.safe_create_table(
        op,
        conn,
        "fin_capital_justifications",
        _uuid_pk(),
        _company(),
        sa.Column("capital_item_id", UUID(as_uuid=False), sa.ForeignKey("fin_capital_items.id", ondelete="SET NULL"), nullable=True),
        sa.Column("equipment_id", UUID(as_uuid=False), sa.ForeignKey("facility_equipment.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("body", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("generated_text", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_by_user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        *_ts(),
    )
    ah.safe_create_index(op, conn, "ix_fin_capital_justifications_company_id", "fin_capital_justifications", ["company_id"])

    for table in _TABLES:
        if ah.table_exists(conn, table):
            _apply_rls(conn, table)


def downgrade() -> None:
    conn = op.get_bind()
    for table in reversed(_TABLES):
        ah.safe_drop_table(op, conn, table)
    ah.safe_drop_column(op, conn, "pm_tasks", "estimated_cost")
