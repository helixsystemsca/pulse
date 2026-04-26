"""
Pulse · Centralized Config System
Migration 0070: pulse_config table + company location fields

Revision ID: 0070_pulse_config
Revises: 0069_gateway_floor_position
Create Date: 2026-04-25

What this creates
------------------
1. pulse_config — the single source of truth for all configurable behaviour.
   Replaces the three parallel config tables over time:
     - pulse_org_module_settings     (module toggles)
     - pulse_work_request_settings   (WR-specific config)
     - automation_feature_configs    (automation rules)
   Those tables stay and keep working — this table extends them, doesn't delete them.
   Modules migrate to read from pulse_config one at a time.

2. companies.latitude / companies.longitude — fix the hardcoded North Saanich
   weather coordinates. timezone already exists on Company model.

Config table design
--------------------
Each row is one config value. Unique on (company_id, module, scope_type, scope_id, key).

  module      — which product area owns this value: "global" | "workRequests" |
                 "schedule" | "workers" | "zones" | "automation" | "compliance" |
                 "notifications" | "gamification"
  scope_type  — "company" (applies everywhere) | "zone" (applies to one zone only)
  scope_id    — NULL for company scope, zone UUID for zone scope
  key         — dot-notation config key, e.g. "facilityCount", "timezone",
                 "certifications.definitions", "sla.p1_response_minutes"
  value       — JSONB (strings, numbers, booleans, arrays, objects — anything)

Resolution order (highest wins):
  zone override → company setting → platform default (in code)

Why one row per key instead of one row per module JSONB blob
-------------------------------------------------------------
One row per key means:
  - Zone overrides can target individual keys without replacing the whole module blob
  - Adding a new config key requires zero migrations
  - Audit log is per-key (see who changed facilityCount and when)
  - Frontend can read/write individual keys without fetching the full blob
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision      = "0070_pulse_config"
down_revision = "0069_gateway_floor_position"
branch_labels = None
depends_on    = None


def upgrade() -> None:

    # ── 1. pulse_config ───────────────────────────────────────────────────────
    op.create_table(
        "pulse_config",
        sa.Column("id",          UUID(as_uuid=False), primary_key=True, nullable=False),
        sa.Column("company_id",  UUID(as_uuid=False),
                  sa.ForeignKey("companies.id", ondelete="CASCADE"),
                  nullable=False, index=True),

        # Which product module owns this value
        sa.Column("module",      sa.String(64),  nullable=False,
                  comment="global | workRequests | schedule | workers | zones | "
                          "automation | compliance | notifications | gamification"),

        # company = applies everywhere; zone = overrides for one zone only
        sa.Column("scope_type",  sa.String(16),  nullable=False, server_default="company",
                  comment="company | zone"),
        sa.Column("scope_id",    UUID(as_uuid=False), nullable=True, index=True,
                  comment="NULL for company scope, zone UUID for zone scope"),

        # The config key in dot-notation
        sa.Column("key",         sa.String(128), nullable=False,
                  comment="e.g. facilityCount, sla.p1_response_minutes, "
                          "certifications.definitions"),

        # The config value — any JSON type
        sa.Column("value",       JSONB,          nullable=False,
                  comment="Any JSON value — string, number, boolean, array, object"),

        # Who last changed it and when
        sa.Column("updated_by",  UUID(as_uuid=False), nullable=True,
                  comment="users.id of last editor"),
        sa.Column("updated_at",  sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("created_at",  sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
    )

    # Unique: one value per (company, module, scope, key)
    op.create_unique_constraint(
        "uq_pulse_config_company_module_scope_key",
        "pulse_config",
        ["company_id", "module", "scope_type", "scope_id", "key"],
    )

    # Fast lookup: "give me all config for company X in module Y"
    op.create_index(
        "ix_pulse_config_company_module",
        "pulse_config",
        ["company_id", "module"],
    )

    # Fast lookup: "give me all zone overrides for zone Z"
    op.create_index(
        "ix_pulse_config_scope",
        "pulse_config",
        ["company_id", "scope_type", "scope_id"],
    )

    # ── 2. companies.latitude / longitude ────────────────────────────────────
    # timezone already exists — just adding the coordinate columns
    op.add_column(
        "companies",
        sa.Column("latitude",  sa.Float(), nullable=True,
                  comment="Facility latitude for weather widget. "
                          "If null, weather widget is hidden."),
    )
    op.add_column(
        "companies",
        sa.Column("longitude", sa.Float(), nullable=True,
                  comment="Facility longitude for weather widget."),
    )


def downgrade() -> None:
    op.drop_column("companies", "longitude")
    op.drop_column("companies", "latitude")
    op.drop_index("ix_pulse_config_scope",          table_name="pulse_config")
    op.drop_index("ix_pulse_config_company_module",  table_name="pulse_config")
    op.drop_constraint("uq_pulse_config_company_module_scope_key", "pulse_config")
    op.drop_table("pulse_config")
