"""Vernon recreation ops pack — contractors, inspections, checklists, QR, equipment facility link.

RLS is enabled on new tables in this same revision (see docs/RLS_POLICY_STRATEGY.md).
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import JSONB, UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1052_vernon_ops_pack"
down_revision = "1051_rls_coverage"
branch_labels = None
depends_on = None

_TS = sa.text("timezone('utc', now())")
_EMPTY = sa.text("'[]'::jsonb")
_IDENT_RE = re.compile(r"^[a-z_][a-z0-9_]*$")


def _quote(name: str) -> str:
    if not _IDENT_RE.match(name):
        raise ValueError(f"refusing non-identifier table name: {name!r}")
    return f'"{name}"'


def _enable_tenant_rls(conn, table: str) -> None:
    q = _quote(table)
    conn.execute(text(f"ALTER TABLE {q} ENABLE ROW LEVEL SECURITY"))
    conn.execute(text(f"ALTER TABLE {q} FORCE ROW LEVEL SECURITY"))
    using = "public.pulse_rls_tenant_visible(company_id)"
    names = {
        "select": f"pulse_rls_{table}_select",
        "insert": f"pulse_rls_{table}_insert",
        "update": f"pulse_rls_{table}_update",
        "delete": f"pulse_rls_{table}_delete",
    }
    for pol in names.values():
        conn.execute(text(f"DROP POLICY IF EXISTS {_quote(pol)} ON {q}"))
    conn.execute(text(f'CREATE POLICY {_quote(names["select"])} ON {q} FOR SELECT USING ({using})'))
    conn.execute(text(f'CREATE POLICY {_quote(names["insert"])} ON {q} FOR INSERT WITH CHECK ({using})'))
    conn.execute(
        text(
            f'CREATE POLICY {_quote(names["update"])} ON {q} FOR UPDATE '
            f"USING ({using}) WITH CHECK ({using})"
        )
    )
    conn.execute(text(f'CREATE POLICY {_quote(names["delete"])} ON {q} FOR DELETE USING ({using})'))


def upgrade() -> None:
    conn = op.get_bind()

    # —— Contractors pack ——
    contractor_cols = [
        ("contact_email", sa.Column("contact_email", sa.String(255), nullable=True)),
        ("contact_phone", sa.Column("contact_phone", sa.String(64), nullable=True)),
        ("insurance_carrier", sa.Column("insurance_carrier", sa.String(255), nullable=True)),
        ("insurance_policy", sa.Column("insurance_policy", sa.String(128), nullable=True)),
        ("insurance_expiry", sa.Column("insurance_expiry", sa.Date(), nullable=True)),
        ("wcb_account", sa.Column("wcb_account", sa.String(128), nullable=True)),
        ("wcb_expiry", sa.Column("wcb_expiry", sa.Date(), nullable=True)),
        ("hourly_rate", sa.Column("hourly_rate", sa.String(64), nullable=True)),
        ("after_hours_rate", sa.Column("after_hours_rate", sa.String(64), nullable=True)),
        ("tickets", sa.Column("tickets", JSONB(), nullable=False, server_default=_EMPTY)),
        ("safety_docs", sa.Column("safety_docs", JSONB(), nullable=False, server_default=_EMPTY)),
        ("agreements", sa.Column("agreements", JSONB(), nullable=False, server_default=_EMPTY)),
        ("serviced_assets", sa.Column("serviced_assets", JSONB(), nullable=False, server_default=_EMPTY)),
        ("serviced_facilities", sa.Column("serviced_facilities", JSONB(), nullable=False, server_default=_EMPTY)),
    ]
    for name, col in contractor_cols:
        ah.safe_add_column(op, conn, "ops_contractors", col)

    # —— Seasonal checklist instances ——
    ah.safe_add_column(
        op,
        conn,
        "ops_checklist_instances",
        sa.Column(
            "facility_id",
            UUID(as_uuid=False),
            sa.ForeignKey("ops_facilities.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    ah.safe_add_column(
        op,
        conn,
        "ops_checklist_instances",
        sa.Column("season_year", sa.Integer(), nullable=True),
    )
    ah.safe_create_index(
        op, conn, "ix_ops_checklist_instances_facility_id", "ops_checklist_instances", ["facility_id"]
    )

    # —— Equipment ↔ recreation facility ——
    ah.safe_add_column(
        op,
        conn,
        "facility_equipment",
        sa.Column(
            "ops_facility_id",
            UUID(as_uuid=False),
            sa.ForeignKey("ops_facilities.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    ah.safe_create_index(
        op, conn, "ix_facility_equipment_ops_facility_id", "facility_equipment", ["ops_facility_id"]
    )

    # —— Inspection runs (persisted field inspections) ——
    ah.safe_create_table(
        op,
        conn,
        "pulse_inspection_runs",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column(
            "company_id",
            UUID(as_uuid=False),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("template_key", sa.String(128), nullable=True),
        sa.Column("template_type", sa.String(64), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="submitted"),
        sa.Column("overall_result", sa.String(32), nullable=True),
        sa.Column(
            "facility_id",
            UUID(as_uuid=False),
            sa.ForeignKey("ops_facilities.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "equipment_id",
            UUID(as_uuid=False),
            sa.ForeignKey("facility_equipment.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "zone_id",
            UUID(as_uuid=False),
            sa.ForeignKey("zones.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("evidence", JSONB(), nullable=False, server_default=_EMPTY),
        sa.Column("values", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column(
            "created_by_user_id",
            UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
    )
    ah.safe_create_index(op, conn, "ix_pulse_inspection_runs_company_id", "pulse_inspection_runs", ["company_id"])
    ah.safe_create_index(op, conn, "ix_pulse_inspection_runs_equipment_id", "pulse_inspection_runs", ["equipment_id"])
    ah.safe_create_index(op, conn, "ix_pulse_inspection_runs_created_at", "pulse_inspection_runs", ["created_at"])

    ah.safe_create_table(
        op,
        conn,
        "pulse_inspection_items",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column(
            "company_id",
            UUID(as_uuid=False),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "run_id",
            UUID(as_uuid=False),
            sa.ForeignKey("pulse_inspection_runs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("result", sa.String(32), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("evidence", JSONB(), nullable=False, server_default=_EMPTY),
        sa.Column(
            "work_request_id",
            UUID(as_uuid=False),
            sa.ForeignKey("pulse_work_requests.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
    )
    ah.safe_create_index(op, conn, "ix_pulse_inspection_items_company_id", "pulse_inspection_items", ["company_id"])
    ah.safe_create_index(op, conn, "ix_pulse_inspection_items_run_id", "pulse_inspection_items", ["run_id"])
    ah.safe_create_index(
        op, conn, "ix_pulse_inspection_items_work_request_id", "pulse_inspection_items", ["work_request_id"]
    )

    ah.safe_add_column(
        op,
        conn,
        "pulse_work_requests",
        sa.Column(
            "inspection_run_id",
            UUID(as_uuid=False),
            sa.ForeignKey("pulse_inspection_runs.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    ah.safe_add_column(
        op,
        conn,
        "pulse_work_requests",
        sa.Column(
            "inspection_item_id",
            UUID(as_uuid=False),
            sa.ForeignKey("pulse_inspection_items.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    ah.safe_create_index(
        op, conn, "ix_pulse_work_requests_inspection_run_id", "pulse_work_requests", ["inspection_run_id"]
    )
    ah.safe_create_index(
        op, conn, "ix_pulse_work_requests_inspection_item_id", "pulse_work_requests", ["inspection_item_id"]
    )

    if ah.table_exists(conn, "pulse_inspection_runs"):
        _enable_tenant_rls(conn, "pulse_inspection_runs")
    if ah.table_exists(conn, "pulse_inspection_items"):
        _enable_tenant_rls(conn, "pulse_inspection_items")


def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, "ix_pulse_work_requests_inspection_item_id", "pulse_work_requests")
    ah.safe_drop_index(op, conn, "ix_pulse_work_requests_inspection_run_id", "pulse_work_requests")
    ah.safe_drop_column(op, conn, "pulse_work_requests", "inspection_item_id")
    ah.safe_drop_column(op, conn, "pulse_work_requests", "inspection_run_id")
    ah.safe_drop_table(op, conn, "pulse_inspection_items")
    ah.safe_drop_table(op, conn, "pulse_inspection_runs")
    ah.safe_drop_index(op, conn, "ix_facility_equipment_ops_facility_id", "facility_equipment")
    ah.safe_drop_column(op, conn, "facility_equipment", "ops_facility_id")
    ah.safe_drop_index(op, conn, "ix_ops_checklist_instances_facility_id", "ops_checklist_instances")
    ah.safe_drop_column(op, conn, "ops_checklist_instances", "season_year")
    ah.safe_drop_column(op, conn, "ops_checklist_instances", "facility_id")
    for col in (
        "serviced_facilities",
        "serviced_assets",
        "agreements",
        "safety_docs",
        "tickets",
        "after_hours_rate",
        "hourly_rate",
        "wcb_expiry",
        "wcb_account",
        "insurance_expiry",
        "insurance_policy",
        "insurance_carrier",
        "contact_phone",
        "contact_email",
    ):
        ah.safe_drop_column(op, conn, "ops_contractors", col)
