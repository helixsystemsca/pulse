"""Recreation ops foundation — knowledge, meetings, people, contractors, regulations, facilities, notes, contacts."""

from __future__ import annotations

import sys
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1047_recreation_ops_foundation"
down_revision = "1046_project_roadmap_stub"
branch_labels = None
depends_on = None

_TS = sa.text("timezone('utc', now())")
_EMPTY = sa.text("'[]'::jsonb")
_OBJ = sa.text("'{}'::jsonb")


def _shared_cols():
    return [
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(64), nullable=False, server_default="active"),
        sa.Column("tags", JSONB(), nullable=False, server_default=_EMPTY),
        sa.Column("attachments", JSONB(), nullable=False, server_default=_EMPTY),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by_user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
    ]


def upgrade() -> None:
    conn = op.get_bind()

    ah.safe_create_table(
        op,
        conn,
        "ops_knowledge_articles",
        *_shared_cols(),
        sa.Column("category", sa.String(128), nullable=False, server_default="Facility Notes"),
        sa.Column("body_rich", sa.Text(), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
    )
    ah.safe_create_index(op, conn, "ix_ops_knowledge_articles_company_id", "ops_knowledge_articles", ["company_id"])

    ah.safe_create_table(
        op,
        conn,
        "ops_meetings",
        *_shared_cols(),
        sa.Column("meeting_date", sa.Date(), nullable=True),
        sa.Column("participants", JSONB(), nullable=False, server_default=_EMPTY),
        sa.Column("decisions", JSONB(), nullable=False, server_default=_EMPTY),
        sa.Column("action_items", JSONB(), nullable=False, server_default=_EMPTY),
    )
    ah.safe_create_index(op, conn, "ix_ops_meetings_company_id", "ops_meetings", ["company_id"])

    ah.safe_create_table(
        op,
        conn,
        "ops_people",
        *_shared_cols(),
        sa.Column("position", sa.String(255), nullable=True),
        sa.Column("department", sa.String(128), nullable=True),
        sa.Column("responsibilities", sa.Text(), nullable=True),
        sa.Column("expertise", JSONB(), nullable=False, server_default=_EMPTY),
        sa.Column("certifications", JSONB(), nullable=False, server_default=_EMPTY),
        sa.Column("cross_training", JSONB(), nullable=False, server_default=_EMPTY),
    )
    ah.safe_create_index(op, conn, "ix_ops_people_company_id", "ops_people", ["company_id"])

    ah.safe_create_table(
        op,
        conn,
        "ops_contractors",
        *_shared_cols(),
        sa.Column("company_name", sa.String(255), nullable=True),
        sa.Column("primary_contact", sa.String(255), nullable=True),
        sa.Column("trade", sa.String(128), nullable=True),
        sa.Column("services_provided", sa.Text(), nullable=True),
        sa.Column("emergency_contact", sa.String(255), nullable=True),
        sa.Column("preferred_vendor", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    ah.safe_create_index(op, conn, "ix_ops_contractors_company_id", "ops_contractors", ["company_id"])

    ah.safe_create_table(
        op,
        conn,
        "ops_regulations",
        *_shared_cols(),
        sa.Column("authority", sa.String(255), nullable=False, server_default=""),
        sa.Column("regulation_name", sa.String(512), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("requirements", sa.Text(), nullable=True),
        sa.Column("inspection_frequency", sa.String(128), nullable=True),
        sa.Column("external_references", JSONB(), nullable=False, server_default=_EMPTY),
    )
    ah.safe_create_index(op, conn, "ix_ops_regulations_company_id", "ops_regulations", ["company_id"])

    ah.safe_create_table(
        op,
        conn,
        "ops_facilities",
        *_shared_cols(),
        sa.Column("building_info", sa.Text(), nullable=True),
        sa.Column("mechanical_systems", sa.Text(), nullable=True),
        sa.Column("emergency_procedures", sa.Text(), nullable=True),
        sa.Column("photos", JSONB(), nullable=False, server_default=_EMPTY),
        sa.Column("documents", JSONB(), nullable=False, server_default=_EMPTY),
    )
    ah.safe_create_index(op, conn, "ix_ops_facilities_company_id", "ops_facilities", ["company_id"])

    ah.safe_create_table(
        op,
        conn,
        "ops_quick_notes",
        *_shared_cols(),
        sa.Column("priority", sa.String(32), nullable=False, server_default="normal"),
        sa.Column("follow_up_status", sa.String(64), nullable=False, server_default="open"),
        sa.Column("images", JSONB(), nullable=False, server_default=_EMPTY),
    )
    ah.safe_create_index(op, conn, "ix_ops_quick_notes_company_id", "ops_quick_notes", ["company_id"])

    ah.safe_create_table(
        op,
        conn,
        "ops_contacts",
        *_shared_cols(),
        sa.Column("contact_type", sa.String(64), nullable=False, server_default="other"),
        sa.Column("organization", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(64), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("role_label", sa.String(255), nullable=True),
    )
    ah.safe_create_index(op, conn, "ix_ops_contacts_company_id", "ops_contacts", ["company_id"])

    ah.safe_create_table(
        op,
        conn,
        "ops_entity_links",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("from_type", sa.String(64), nullable=False),
        sa.Column("from_id", UUID(as_uuid=False), nullable=False),
        sa.Column("to_type", sa.String(64), nullable=False),
        sa.Column("to_id", UUID(as_uuid=False), nullable=False),
        sa.Column("link_role", sa.String(64), nullable=False, server_default="related"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
        sa.UniqueConstraint(
            "company_id",
            "from_type",
            "from_id",
            "to_type",
            "to_id",
            "link_role",
            name="uq_ops_entity_links",
        ),
    )
    ah.safe_create_index(op, conn, "ix_ops_entity_links_company_id", "ops_entity_links", ["company_id"])
    ah.safe_create_index(op, conn, "ix_ops_entity_links_from", "ops_entity_links", ["from_type", "from_id"])
    ah.safe_create_index(op, conn, "ix_ops_entity_links_to", "ops_entity_links", ["to_type", "to_id"])

    ah.safe_create_table(
        op,
        conn,
        "ops_revisions",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("entity_type", sa.String(64), nullable=False),
        sa.Column("entity_id", UUID(as_uuid=False), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("snapshot", JSONB(), nullable=False, server_default=_OBJ),
        sa.Column("changed_by_user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_TS),
    )
    ah.safe_create_index(op, conn, "ix_ops_revisions_company_id", "ops_revisions", ["company_id"])
    ah.safe_create_index(op, conn, "ix_ops_revisions_entity", "ops_revisions", ["entity_type", "entity_id"])


def downgrade() -> None:
    conn = op.get_bind()
    for table, indexes in [
        ("ops_revisions", ["ix_ops_revisions_entity", "ix_ops_revisions_company_id"]),
        ("ops_entity_links", ["ix_ops_entity_links_to", "ix_ops_entity_links_from", "ix_ops_entity_links_company_id"]),
        ("ops_contacts", ["ix_ops_contacts_company_id"]),
        ("ops_quick_notes", ["ix_ops_quick_notes_company_id"]),
        ("ops_facilities", ["ix_ops_facilities_company_id"]),
        ("ops_regulations", ["ix_ops_regulations_company_id"]),
        ("ops_contractors", ["ix_ops_contractors_company_id"]),
        ("ops_people", ["ix_ops_people_company_id"]),
        ("ops_meetings", ["ix_ops_meetings_company_id"]),
        ("ops_knowledge_articles", ["ix_ops_knowledge_articles_company_id"]),
    ]:
        for idx in indexes:
            ah.safe_drop_index(op, conn, idx, table)
        ah.safe_drop_table(op, conn, table)
