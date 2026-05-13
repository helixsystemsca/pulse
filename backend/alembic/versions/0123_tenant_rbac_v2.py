"""RBAC v2: catalog permissions, tenant departments/roles/grants, optional user.tenant_role_id."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import column, String, Text, table

revision = "0123_tenant_rbac_v2"
down_revision = "0122_inventory_item_department_slug"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "rbac_catalog_permissions",
        sa.Column("key", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("key"),
    )
    op.create_table(
        "tenant_departments",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("company_id", sa.String(length=36), nullable=False),
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("company_id", "slug", name="uq_tenant_departments_company_slug"),
    )
    op.create_index("ix_tenant_departments_company_id", "tenant_departments", ["company_id"])

    op.create_table(
        "tenant_roles",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("company_id", sa.String(length=36), nullable=False),
        sa.Column("department_id", sa.String(length=36), nullable=False),
        sa.Column("slug", sa.String(length=96), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["department_id"], ["tenant_departments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("company_id", "slug", name="uq_tenant_roles_company_slug"),
    )
    op.create_index("ix_tenant_roles_company_id", "tenant_roles", ["company_id"])
    op.create_index("ix_tenant_roles_department_id", "tenant_roles", ["department_id"])

    op.create_table(
        "tenant_role_grants",
        sa.Column("tenant_role_id", sa.String(length=36), nullable=False),
        sa.Column("permission_key", sa.String(length=160), nullable=False),
        sa.ForeignKeyConstraint(["tenant_role_id"], ["tenant_roles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["permission_key"], ["rbac_catalog_permissions.key"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("tenant_role_id", "permission_key"),
    )

    seed = [
        ("work_requests.view", "View work requests"),
        ("work_requests.edit", "Edit work requests"),
        ("compliance.view", "View inspections & compliance"),
        ("inventory.view", "View inventory"),
        ("inventory.manage", "Manage inventory"),
        ("equipment.view", "View equipment"),
        ("procedures.view", "View procedures / standards"),
        ("team_insights.view", "View team insights / analytics"),
        ("team_management.view", "Open Team Management"),
        ("messaging.view", "View messaging"),
        ("schedule.view", "View scheduling / classes"),
        ("monitoring.view", "View monitoring"),
        ("projects.view", "View projects"),
        ("drawings.view", "View drawings"),
        ("zones_devices.view", "View zones & devices"),
        ("live_map.view", "View live map"),
        ("arena_advertising.view", "Arena advertising mapper"),
        ("social_planner.view", "Social / campaign planner"),
        ("publication_pipeline.view", "Publication pipeline"),
        ("xplor_indesign.view", "Xplor → InDesign export"),
        ("communications_assets.view", "Communications assets library"),
        ("workspace.view", "Open a department workspace hub"),
    ]
    perm_table = table(
        "rbac_catalog_permissions",
        column("key", String),
        column("description", Text),
    )
    op.bulk_insert(perm_table, [{"key": k, "description": d} for k, d in seed])

    op.add_column(
        "users",
        sa.Column("tenant_role_id", sa.String(length=36), nullable=True),
    )
    op.create_foreign_key(
        "fk_users_tenant_role_id",
        "users",
        "tenant_roles",
        ["tenant_role_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_users_tenant_role_id", "users", ["tenant_role_id"])


def downgrade() -> None:
    op.drop_index("ix_users_tenant_role_id", table_name="users")
    op.drop_constraint("fk_users_tenant_role_id", "users", type_="foreignkey")
    op.drop_column("users", "tenant_role_id")
    op.drop_table("tenant_role_grants")
    op.drop_index("ix_tenant_roles_department_id", table_name="tenant_roles")
    op.drop_index("ix_tenant_roles_company_id", table_name="tenant_roles")
    op.drop_table("tenant_roles")
    op.drop_index("ix_tenant_departments_company_id", table_name="tenant_departments")
    op.drop_table("tenant_departments")
    op.drop_table("rbac_catalog_permissions")
