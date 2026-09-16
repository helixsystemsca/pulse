"""Hire-time onboarding document packets (template + per-hire checklist).

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

revision = "1056_hire_onboarding"
down_revision = "1055_facility_links"
branch_labels = None
depends_on = None

_TS = sa.text("timezone('utc', now())")
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

    ah.safe_create_table(
        op,
        conn,
        "pulse_hire_onboarding_templates",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column(
            "company_id",
            UUID(as_uuid=False),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(128), nullable=False, server_default=sa.text("'Default hire packet'")),
        sa.Column("items", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
    )
    ah.safe_create_index(
        op,
        conn,
        "uq_pulse_hire_onboarding_templates_company",
        "pulse_hire_onboarding_templates",
        ["company_id"],
        unique=True,
    )

    ah.safe_create_table(
        op,
        conn,
        "pulse_hire_onboarding_packets",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column(
            "company_id",
            UUID(as_uuid=False),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "template_id",
            UUID(as_uuid=False),
            sa.ForeignKey("pulse_hire_onboarding_templates.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("status", sa.String(16), nullable=False, server_default=sa.text("'open'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    ah.safe_create_index(
        op,
        conn,
        "ix_pulse_hire_onboarding_packets_company_id",
        "pulse_hire_onboarding_packets",
        ["company_id"],
    )
    ah.safe_create_index(
        op,
        conn,
        "uq_pulse_hire_onboarding_packets_user",
        "pulse_hire_onboarding_packets",
        ["user_id"],
        unique=True,
    )
    ah.safe_create_index(
        op,
        conn,
        "ix_pulse_hire_onboarding_packets_status",
        "pulse_hire_onboarding_packets",
        ["company_id", "status"],
    )

    ah.safe_create_table(
        op,
        conn,
        "pulse_hire_onboarding_items",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column(
            "company_id",
            UUID(as_uuid=False),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "packet_id",
            UUID(as_uuid=False),
            sa.ForeignKey("pulse_hire_onboarding_packets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("template_item_id", sa.String(64), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("item_key", sa.String(64), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("kind", sa.String(16), nullable=False, server_default=sa.text("'review'")),
        sa.Column("body_text", sa.Text(), nullable=True),
        sa.Column("is_required", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("status", sa.String(16), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "completed_by_user_id",
            UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("signature_name", sa.String(255), nullable=True),
        sa.Column("signed_ack", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
    )
    ah.safe_create_index(
        op,
        conn,
        "ix_pulse_hire_onboarding_items_company_id",
        "pulse_hire_onboarding_items",
        ["company_id"],
    )
    ah.safe_create_index(
        op,
        conn,
        "ix_pulse_hire_onboarding_items_packet_id",
        "pulse_hire_onboarding_items",
        ["packet_id"],
    )

    for table in (
        "pulse_hire_onboarding_templates",
        "pulse_hire_onboarding_packets",
        "pulse_hire_onboarding_items",
    ):
        _enable_tenant_rls(conn, table)


def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_table(op, conn, "pulse_hire_onboarding_items")
    ah.safe_drop_table(op, conn, "pulse_hire_onboarding_packets")
    ah.safe_drop_table(op, conn, "pulse_hire_onboarding_templates")
