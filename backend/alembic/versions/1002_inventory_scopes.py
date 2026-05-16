"""Inventory scopes, department mappings, and inventory_items.scope_id (scoped visibility per tenant)."""

from __future__ import annotations

import sys
from pathlib import Path
from uuid import uuid4

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

revision = "1002_inventory_scopes"
down_revision = "1001_tenant_role_feature_keys"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    ah.safe_create_table(
        op,
        conn,
        "inventory_scopes",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(64), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("is_shared", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("company_id", "slug", name="uq_inventory_scope_company_slug"),
    )
    ah.safe_create_index(op, conn, "ix_inventory_scopes_company_id", "inventory_scopes", ["company_id"])

    ah.safe_create_table(
        op,
        conn,
        "department_inventory_scopes",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("department_slug", sa.String(64), nullable=False),
        sa.Column(
            "scope_id",
            UUID(as_uuid=False),
            sa.ForeignKey("inventory_scopes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "company_id",
            "department_slug",
            "scope_id",
            name="uq_department_inventory_scope_row",
        ),
    )
    ah.safe_create_index(
        op,
        conn,
        "ix_department_inventory_scopes_company_slug",
        "department_inventory_scopes",
        ["company_id", "department_slug"],
    )

    if not ah.column_exists(conn, "inventory_items", "scope_id"):
        ah.safe_add_column(
            op,
            conn,
            "inventory_items",
            sa.Column("scope_id", UUID(as_uuid=False), nullable=True),
        )

    pairs = conn.execute(
        sa.text(
            """
            SELECT DISTINCT company_id::text AS cid,
              lower(trim(COALESCE(NULLIF(trim(department_slug), ''), 'maintenance'))) AS slug
            FROM inventory_items
            WHERE scope_id IS NULL
            """
        )
    ).fetchall()

    def ensure_scope(cid_txt: str, slug: str) -> str:
        row = conn.execute(
            sa.text("SELECT id FROM inventory_scopes WHERE company_id = CAST(:cid AS uuid) AND slug = :slug LIMIT 1"),
            {"cid": cid_txt, "slug": slug},
        ).fetchone()
        if row:
            sid = str(row[0])
        else:
            sid = str(uuid4())
            conn.execute(
                sa.text(
                    """
                    INSERT INTO inventory_scopes (id, company_id, name, slug, description, is_shared, created_at)
                    VALUES (CAST(:id AS uuid), CAST(:cid AS uuid), :name, :slug, NULL, false, now())
                    """
                ),
                {"id": sid, "cid": cid_txt, "name": slug.replace("_", " ").title(), "slug": slug},
            )
        mapped = conn.execute(
            sa.text(
                """
                SELECT 1 FROM department_inventory_scopes
                WHERE company_id = CAST(:cid AS uuid)
                  AND department_slug = :slug
                  AND scope_id = CAST(:sid AS uuid)
                LIMIT 1
                """
            ),
            {"cid": cid_txt, "slug": slug, "sid": sid},
        ).fetchone()
        if not mapped:
            conn.execute(
                sa.text(
                    """
                    INSERT INTO department_inventory_scopes (id, company_id, department_slug, scope_id)
                    VALUES (CAST(:id AS uuid), CAST(:cid AS uuid), :slug, CAST(:sid AS uuid))
                    """
                ),
                {"id": str(uuid4()), "cid": cid_txt, "slug": slug, "sid": sid},
            )
        return sid

    for cid_txt, slug in pairs:
        ensure_scope(cid_txt, slug)

    conn.execute(
        sa.text(
            """
            UPDATE inventory_items AS i
            SET scope_id = s.id
            FROM inventory_scopes AS s
            WHERE i.scope_id IS NULL
              AND i.company_id = s.company_id
              AND lower(trim(COALESCE(NULLIF(trim(i.department_slug), ''), 'maintenance'))) = s.slug
            """
        )
    )

    orphan_companies = conn.execute(
        sa.text("SELECT DISTINCT company_id::text FROM inventory_items WHERE scope_id IS NULL")
    ).fetchall()
    for (cid_txt,) in orphan_companies:
        ensure_scope(cid_txt, "maintenance")
        conn.execute(
            sa.text(
                """
                UPDATE inventory_items AS i
                SET scope_id = s.id
                FROM inventory_scopes AS s
                WHERE i.scope_id IS NULL
                  AND i.company_id = s.company_id
                  AND s.slug = 'maintenance'
                  AND i.company_id = CAST(:cid AS uuid)
                """
            ),
            {"cid": cid_txt},
        )

    ah.safe_alter_column(
        op,
        conn,
        "inventory_items",
        "scope_id",
        existing_type=UUID(as_uuid=False),
        nullable=False,
    )

    ah.safe_create_foreign_key(
        op,
        conn,
        "fk_inventory_items_scope_id_inventory_scopes",
        "inventory_items",
        "inventory_scopes",
        ["scope_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    ah.safe_create_index(op, conn, "ix_inventory_items_company_scope", "inventory_items", ["company_id", "scope_id"])

    if ah.column_exists(conn, "inventory_items", "department_slug"):
        ah.safe_alter_column(
            op,
            conn,
            "inventory_items",
            "department_slug",
            existing_type=sa.String(length=32),
            type_=sa.String(length=64),
            existing_nullable=False,
            nullable=False,
        )


def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, "ix_inventory_items_company_scope", "inventory_items")
    ah.safe_drop_constraint(op, conn, "fk_inventory_items_scope_id_inventory_scopes", "inventory_items", type_="foreignkey")
    ah.safe_drop_column(op, conn, "inventory_items", "scope_id")
    ah.safe_drop_index(op, conn, "ix_department_inventory_scopes_company_slug", "department_inventory_scopes")
    ah.safe_drop_table(op, conn, "department_inventory_scopes")
    ah.safe_drop_index(op, conn, "ix_inventory_scopes_company_id", "inventory_scopes")
    ah.safe_drop_table(op, conn, "inventory_scopes")
    if ah.column_exists(conn, "inventory_items", "department_slug"):
        ah.safe_alter_column(
            op,
            conn,
            "inventory_items",
            "department_slug",
            existing_type=sa.String(length=64),
            type_=sa.String(length=32),
            existing_nullable=False,
            nullable=False,
        )
