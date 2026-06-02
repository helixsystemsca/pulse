"""Seed default tenant_departments rows for existing companies."""

from __future__ import annotations

import sys
import uuid
from pathlib import Path

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1031_seed_tenant_departments"
down_revision = "1030_company_operational_notifications"
branch_labels = None
depends_on = None

_DEFAULTS = (
    ("maintenance", "Maintenance"),
    ("communications", "Communications"),
    ("reception", "Reception"),
    ("aquatics", "Aquatics"),
    ("fitness", "Fitness"),
    ("racquets", "Racquets"),
    ("admin", "Administration"),
)


def upgrade() -> None:
    conn = op.get_bind()
    if not ah.table_exists(conn, "tenant_departments") or not ah.table_exists(conn, "companies"):
        return
    company_rows = conn.execute(sa.text("SELECT id FROM companies")).fetchall()
    for (company_id,) in company_rows:
        existing = conn.execute(
            sa.text("SELECT slug FROM tenant_departments WHERE company_id = :cid"),
            {"cid": company_id},
        ).fetchall()
        have = {str(r[0]) for r in existing}
        for slug, name in _DEFAULTS:
            if slug in have:
                continue
            conn.execute(
                sa.text(
                    """
                    INSERT INTO tenant_departments (id, company_id, slug, name, created_at)
                    VALUES (:id, :cid, :slug, :name, timezone('utc', now()))
                    """
                ),
                {"id": str(uuid.uuid4()), "cid": company_id, "slug": slug, "name": name},
            )


def downgrade() -> None:
    # Non-destructive: seeded rows may be referenced by inventory and HR.
    pass
