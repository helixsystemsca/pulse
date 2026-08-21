"""Phase 1 personal command center — profile, role, checklists, knowledge gaps."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1048_ops_command_center"
down_revision = "1047_recreation_ops_foundation"
branch_labels = None
depends_on = None

_TS = sa.text("timezone('utc', now())")
_EMPTY = sa.text("'[]'::jsonb")
_OBJ = sa.text("'{}'::jsonb")


def upgrade() -> None:
    conn = op.get_bind()

    ah.safe_create_table(
        op,
        conn,
        "ops_personal_profiles",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("display_name", sa.String(255), nullable=True),
        sa.Column("position", sa.String(255), nullable=True),
        sa.Column("department", sa.String(128), nullable=True),
        sa.Column("manager_name", sa.String(255), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("contact_info", sa.Text(), nullable=True),
        sa.Column("certifications", JSONB(), nullable=False, server_default=_EMPTY),
        sa.Column("qualifications", JSONB(), nullable=False, server_default=_EMPTY),
        sa.Column("philosophy", JSONB(), nullable=False, server_default=_OBJ),
        sa.Column("principles", JSONB(), nullable=False, server_default=_EMPTY),
        sa.Column("role_purpose", sa.Text(), nullable=True),
        sa.Column("linked_ops_person_id", UUID(as_uuid=False), sa.ForeignKey("ops_people.id", ondelete="SET NULL"), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.UniqueConstraint("company_id", "user_id", name="uq_ops_personal_profiles_user"),
    )
    ah.safe_create_index(op, conn, "ix_ops_personal_profiles_company_id", "ops_personal_profiles", ["company_id"])
    ah.safe_create_index(op, conn, "ix_ops_personal_profiles_user_id", "ops_personal_profiles", ["user_id"])

    ah.safe_create_table(
        op,
        conn,
        "ops_role_responsibilities",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category", sa.String(64), nullable=False, server_default="Operations"),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("priority", sa.String(32), nullable=False, server_default="medium"),
        sa.Column("frequency", sa.String(128), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
    )
    ah.safe_create_index(op, conn, "ix_ops_role_responsibilities_company_id", "ops_role_responsibilities", ["company_id"])
    ah.safe_create_index(op, conn, "ix_ops_role_responsibilities_user_id", "ops_role_responsibilities", ["user_id"])

    ah.safe_create_table(
        op,
        conn,
        "ops_authority_matrix_rows",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("decision", sa.String(512), nullable=False),
        sa.Column("levels", JSONB(), nullable=False, server_default=_OBJ),
        sa.Column("status", sa.String(32), nullable=False, server_default="unknown"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
    )
    ah.safe_create_index(op, conn, "ix_ops_authority_matrix_rows_company_id", "ops_authority_matrix_rows", ["company_id"])
    ah.safe_create_index(op, conn, "ix_ops_authority_matrix_rows_user_id", "ops_authority_matrix_rows", ["user_id"])

    ah.safe_create_table(
        op,
        conn,
        "ops_checklist_templates",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=True),
        sa.Column("slug", sa.String(64), nullable=False),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(64), nullable=False, server_default="onboarding"),
        sa.Column("structure", JSONB(), nullable=False, server_default=_EMPTY),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
    )
    ah.safe_create_index(op, conn, "ix_ops_checklist_templates_company_id", "ops_checklist_templates", ["company_id"])
    ah.safe_create_index(op, conn, "ix_ops_checklist_templates_slug", "ops_checklist_templates", ["slug"])

    ah.safe_create_table(
        op,
        conn,
        "ops_checklist_instances",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("template_id", UUID(as_uuid=False), sa.ForeignKey("ops_checklist_templates.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(64), nullable=False, server_default="personal"),
        sa.Column("priority", sa.String(32), nullable=False, server_default="medium"),
        sa.Column("status", sa.String(32), nullable=False, server_default="active"),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
    )
    ah.safe_create_index(op, conn, "ix_ops_checklist_instances_company_id", "ops_checklist_instances", ["company_id"])
    ah.safe_create_index(op, conn, "ix_ops_checklist_instances_user_id", "ops_checklist_instances", ["user_id"])

    ah.safe_create_table(
        op,
        conn,
        "ops_checklist_items",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("instance_id", UUID(as_uuid=False), sa.ForeignKey("ops_checklist_instances.id", ondelete="CASCADE"), nullable=False),
        sa.Column("section", sa.String(128), nullable=False, server_default="General"),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("completed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("priority", sa.String(32), nullable=False, server_default="medium"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
    )
    ah.safe_create_index(op, conn, "ix_ops_checklist_items_company_id", "ops_checklist_items", ["company_id"])
    ah.safe_create_index(op, conn, "ix_ops_checklist_items_instance_id", "ops_checklist_items", ["instance_id"])

    ah.safe_create_table(
        op,
        conn,
        "ops_knowledge_gaps",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("category", sa.String(128), nullable=False, server_default="General"),
        sa.Column("priority", sa.String(32), nullable=False, server_default="medium"),
        sa.Column("who_should_answer", sa.String(255), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="open"),
        sa.Column("answer", sa.Text(), nullable=True),
        sa.Column("source", sa.String(512), nullable=True),
        sa.Column("date_confirmed", sa.Date(), nullable=True),
        sa.Column("related_policy", sa.String(512), nullable=True),
        sa.Column("related_person", sa.String(255), nullable=True),
        sa.Column("related_procedure", sa.String(512), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
    )
    ah.safe_create_index(op, conn, "ix_ops_knowledge_gaps_company_id", "ops_knowledge_gaps", ["company_id"])
    ah.safe_create_index(op, conn, "ix_ops_knowledge_gaps_user_id", "ops_knowledge_gaps", ["user_id"])


def downgrade() -> None:
    conn = op.get_bind()
    for table, indexes in [
        ("ops_knowledge_gaps", ["ix_ops_knowledge_gaps_user_id", "ix_ops_knowledge_gaps_company_id"]),
        ("ops_checklist_items", ["ix_ops_checklist_items_instance_id", "ix_ops_checklist_items_company_id"]),
        ("ops_checklist_instances", ["ix_ops_checklist_instances_user_id", "ix_ops_checklist_instances_company_id"]),
        ("ops_checklist_templates", ["ix_ops_checklist_templates_slug", "ix_ops_checklist_templates_company_id"]),
        ("ops_authority_matrix_rows", ["ix_ops_authority_matrix_rows_user_id", "ix_ops_authority_matrix_rows_company_id"]),
        ("ops_role_responsibilities", ["ix_ops_role_responsibilities_user_id", "ix_ops_role_responsibilities_company_id"]),
        ("ops_personal_profiles", ["ix_ops_personal_profiles_user_id", "ix_ops_personal_profiles_company_id"]),
    ]:
        for idx in indexes:
            ah.safe_drop_index(op, conn, idx, table)
        ah.safe_drop_table(op, conn, table)
