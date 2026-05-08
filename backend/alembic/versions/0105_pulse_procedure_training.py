"""Pulse procedure training assignments, compliance, sign-offs, notifications."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0105_pulse_procedure_training"
down_revision = "0104_user_auth_provider"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "pulse_procedures",
        sa.Column(
            "content_revision",
            sa.Integer(),
            server_default=sa.text("1"),
            nullable=False,
        ),
    )

    op.create_table(
        "pulse_procedure_compliance_settings",
        sa.Column(
            "procedure_id",
            UUID(as_uuid=False),
            sa.ForeignKey("pulse_procedures.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "company_id",
            UUID(as_uuid=False),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("tier", sa.String(length=32), nullable=False, server_default="general"),
        sa.Column("due_within_days", sa.Integer(), nullable=True),
        sa.Column(
            "requires_acknowledgement",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("timezone('utc', now())"),
            nullable=False,
        ),
        sa.Column(
            "updated_by_user_id",
            UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.CheckConstraint(
            "tier IN ('mandatory', 'high_risk', 'general')",
            name="ck_pulse_proc_compliance_tier",
        ),
    )

    op.create_table(
        "pulse_procedure_training_assignments",
        sa.Column(
            "id",
            UUID(as_uuid=False),
            primary_key=True,
        ),
        sa.Column(
            "company_id",
            UUID(as_uuid=False),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "employee_user_id",
            UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "procedure_id",
            UUID(as_uuid=False),
            sa.ForeignKey("pulse_procedures.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "assigned_by_user_id",
            UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("assigned_date", sa.Date(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expiry_date", sa.Date(), nullable=True),
        sa.Column("acknowledgement_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "supervisor_signoff",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("timezone('utc', now())"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("timezone('utc', now())"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "company_id",
            "employee_user_id",
            "procedure_id",
            name="uq_pulse_proc_training_assign_emp_proc",
        ),
    )

    op.create_table(
        "pulse_procedure_completion_signoffs",
        sa.Column(
            "id",
            UUID(as_uuid=False),
            primary_key=True,
        ),
        sa.Column(
            "company_id",
            UUID(as_uuid=False),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "employee_user_id",
            UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "procedure_id",
            UUID(as_uuid=False),
            sa.ForeignKey("pulse_procedures.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "completed_by_user_id",
            UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("revision_marker", sa.String(length=64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("timezone('utc', now())"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "company_id",
            "employee_user_id",
            "procedure_id",
            "revision_marker",
            name="uq_pulse_proc_signoff_idem",
        ),
    )

    op.create_table(
        "pulse_procedure_acknowledgements",
        sa.Column(
            "id",
            UUID(as_uuid=False),
            primary_key=True,
        ),
        sa.Column(
            "company_id",
            UUID(as_uuid=False),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "employee_user_id",
            UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "procedure_id",
            UUID(as_uuid=False),
            sa.ForeignKey("pulse_procedures.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("revision_number", sa.Integer(), nullable=False),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("timezone('utc', now())"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "company_id",
            "employee_user_id",
            "procedure_id",
            "revision_number",
            name="uq_pulse_proc_ack_idem",
        ),
    )

    op.create_table(
        "pulse_training_notification_events",
        sa.Column(
            "id",
            UUID(as_uuid=False),
            primary_key=True,
        ),
        sa.Column(
            "company_id",
            UUID(as_uuid=False),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("kind", sa.String(length=64), nullable=False),
        sa.Column(
            "payload",
            JSONB,
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("timezone('utc', now())"),
            nullable=False,
            index=True,
        ),
        sa.Column("dedupe_key", sa.String(length=256), nullable=False, unique=True),
    )


def downgrade() -> None:
    op.drop_table("pulse_training_notification_events")
    op.drop_table("pulse_procedure_acknowledgements")
    op.drop_table("pulse_procedure_completion_signoffs")
    op.drop_table("pulse_procedure_training_assignments")
    op.drop_table("pulse_procedure_compliance_settings")
    op.drop_column("pulse_procedures", "content_revision")
