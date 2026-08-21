"""Phase 2 organization — person matrix columns + skills, development plans, team risks."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1049_ops_organization"
down_revision = "1048_ops_command_center"
branch_labels = None
depends_on = None

_TS = sa.text("timezone('utc', now())")
_EMPTY = sa.text("'[]'::jsonb")


def upgrade() -> None:
    conn = op.get_bind()

    # Extend ops_people for Person Matrix / org chart
    for col in [
        sa.Column("reports_to_person_id", UUID(as_uuid=False), nullable=True),
        sa.Column("role_label", sa.String(255), nullable=True),
        sa.Column("training", JSONB(), nullable=False, server_default=_EMPTY),
        sa.Column("strengths", sa.Text(), nullable=True),
        sa.Column("development_opportunities", sa.Text(), nullable=True),
        sa.Column("current_priorities", sa.Text(), nullable=True),
        sa.Column("projects_notes", sa.Text(), nullable=True),
        sa.Column("important_relationships", sa.Text(), nullable=True),
        sa.Column("need_from_me", sa.Text(), nullable=True),
        sa.Column("need_from_them", sa.Text(), nullable=True),
        sa.Column("decision_authority", sa.Text(), nullable=True),
        sa.Column("communication_preference", sa.String(128), nullable=True),
        sa.Column("team_name", sa.String(128), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    ]:
        ah.safe_add_column(op, conn, "ops_people", col)

    ah.safe_create_foreign_key(
        op,
        conn,
        "fk_ops_people_reports_to",
        "ops_people",
        "ops_people",
        ["reports_to_person_id"],
        ["id"],
        ondelete="SET NULL",
    )

    ah.safe_create_index(op, conn, "ix_ops_people_reports_to_person_id", "ops_people", ["reports_to_person_id"])

    ah.safe_create_table(
        op,
        conn,
        "ops_skills",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("category", sa.String(128), nullable=False, server_default="General"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.UniqueConstraint("company_id", "name", name="uq_ops_skills_company_name"),
    )
    ah.safe_create_index(op, conn, "ix_ops_skills_company_id", "ops_skills", ["company_id"])

    ah.safe_create_table(
        op,
        conn,
        "ops_skill_ratings",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("skill_id", UUID(as_uuid=False), sa.ForeignKey("ops_skills.id", ondelete="CASCADE"), nullable=False),
        sa.Column("person_id", UUID(as_uuid=False), sa.ForeignKey("ops_people.id", ondelete="CASCADE"), nullable=False),
        sa.Column("proficiency", sa.String(32), nullable=False, server_default="beginner"),
        sa.Column("certification", sa.String(255), nullable=True),
        sa.Column("last_demonstrated", sa.Date(), nullable=True),
        sa.Column("training_required", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("cross_training_status", sa.String(64), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.UniqueConstraint("company_id", "skill_id", "person_id", name="uq_ops_skill_ratings_person"),
    )
    ah.safe_create_index(op, conn, "ix_ops_skill_ratings_company_id", "ops_skill_ratings", ["company_id"])
    ah.safe_create_index(op, conn, "ix_ops_skill_ratings_skill_id", "ops_skill_ratings", ["skill_id"])
    ah.safe_create_index(op, conn, "ix_ops_skill_ratings_person_id", "ops_skill_ratings", ["person_id"])

    ah.safe_create_table(
        op,
        conn,
        "ops_development_plans",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("person_id", UUID(as_uuid=False), sa.ForeignKey("ops_people.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(512), nullable=False, server_default="Development plan"),
        sa.Column("strengths", sa.Text(), nullable=True),
        sa.Column("development_goals", sa.Text(), nullable=True),
        sa.Column("training", sa.Text(), nullable=True),
        sa.Column("mentoring", sa.Text(), nullable=True),
        sa.Column("cross_training", sa.Text(), nullable=True),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column("progress", sa.String(32), nullable=False, server_default="not_started"),
        sa.Column("status", sa.String(32), nullable=False, server_default="active"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
    )
    ah.safe_create_index(op, conn, "ix_ops_development_plans_company_id", "ops_development_plans", ["company_id"])
    ah.safe_create_index(op, conn, "ix_ops_development_plans_person_id", "ops_development_plans", ["person_id"])

    ah.safe_create_table(
        op,
        conn,
        "ops_team_risks",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("risk_type", sa.String(64), nullable=False, server_default="skill_shortage"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("severity", sa.String(32), nullable=False, server_default="medium"),
        sa.Column("related_person_id", UUID(as_uuid=False), sa.ForeignKey("ops_people.id", ondelete="SET NULL"), nullable=True),
        sa.Column("related_skill", sa.String(255), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="open"),
        sa.Column("mitigation", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
    )
    ah.safe_create_index(op, conn, "ix_ops_team_risks_company_id", "ops_team_risks", ["company_id"])


def downgrade() -> None:
    conn = op.get_bind()
    for table, indexes in [
        ("ops_team_risks", ["ix_ops_team_risks_company_id"]),
        ("ops_development_plans", ["ix_ops_development_plans_person_id", "ix_ops_development_plans_company_id"]),
        (
            "ops_skill_ratings",
            [
                "ix_ops_skill_ratings_person_id",
                "ix_ops_skill_ratings_skill_id",
                "ix_ops_skill_ratings_company_id",
            ],
        ),
        ("ops_skills", ["ix_ops_skills_company_id"]),
    ]:
        for idx in indexes:
            ah.safe_drop_index(op, conn, idx, table)
        ah.safe_drop_table(op, conn, table)

    ah.safe_drop_index(op, conn, "ix_ops_people_reports_to_person_id", "ops_people")
    ah.safe_drop_constraint(op, conn, "fk_ops_people_reports_to", "ops_people", type_="foreignkey")
    for col in [
        "sort_order",
        "team_name",
        "communication_preference",
        "decision_authority",
        "need_from_them",
        "need_from_me",
        "important_relationships",
        "projects_notes",
        "current_priorities",
        "development_opportunities",
        "strengths",
        "training",
        "role_label",
        "reports_to_person_id",
    ]:
        ah.safe_drop_column(op, conn, "ops_people", col)
