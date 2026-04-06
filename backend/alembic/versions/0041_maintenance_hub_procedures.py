"""Procedures, preventative rules, work order type + procedure link on pulse_work_requests."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0041"
down_revision = "0040"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pulse_procedures",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("company_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("steps", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_pulse_procedures_company_id", "pulse_procedures", ["company_id"])

    op.create_table(
        "pulse_preventative_rules",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("company_id", sa.String(length=36), nullable=False),
        sa.Column("equipment_id", sa.String(length=36), nullable=False),
        sa.Column("frequency", sa.String(length=128), nullable=False),
        sa.Column("procedure_id", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["equipment_id"], ["facility_equipment.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["procedure_id"], ["pulse_procedures.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_pulse_preventative_rules_company_id", "pulse_preventative_rules", ["company_id"])
    op.create_index(
        "ix_pulse_preventative_rules_equipment_id", "pulse_preventative_rules", ["equipment_id"]
    )

    op.add_column(
        "pulse_work_requests",
        sa.Column(
            "work_order_type",
            sa.String(length=16),
            nullable=False,
            server_default="issue",
        ),
    )
    op.add_column(
        "pulse_work_requests",
        sa.Column("procedure_id", sa.String(length=36), nullable=True),
    )
    op.create_index("ix_pulse_work_requests_work_order_type", "pulse_work_requests", ["work_order_type"])
    op.create_index("ix_pulse_work_requests_procedure_id", "pulse_work_requests", ["procedure_id"])
    op.create_foreign_key(
        "fk_pulse_work_requests_procedure_id",
        "pulse_work_requests",
        "pulse_procedures",
        ["procedure_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.execute(sa.text("UPDATE pulse_work_requests SET work_order_type = 'issue' WHERE work_order_type IS NULL"))
    op.alter_column(
        "pulse_work_requests",
        "work_order_type",
        server_default=None,
    )


def downgrade() -> None:
    op.drop_constraint("fk_pulse_work_requests_procedure_id", "pulse_work_requests", type_="foreignkey")
    op.drop_index("ix_pulse_work_requests_procedure_id", table_name="pulse_work_requests")
    op.drop_index("ix_pulse_work_requests_work_order_type", table_name="pulse_work_requests")
    op.drop_column("pulse_work_requests", "procedure_id")
    op.drop_column("pulse_work_requests", "work_order_type")
    op.drop_index("ix_pulse_preventative_rules_equipment_id", table_name="pulse_preventative_rules")
    op.drop_index("ix_pulse_preventative_rules_company_id", table_name="pulse_preventative_rules")
    op.drop_table("pulse_preventative_rules")
    op.drop_index("ix_pulse_procedures_company_id", table_name="pulse_procedures")
    op.drop_table("pulse_procedures")
