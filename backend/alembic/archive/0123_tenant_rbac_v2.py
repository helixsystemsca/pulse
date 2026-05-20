"""RBAC v2: catalog permissions, tenant departments/roles/grants, optional user.tenant_role_id."""
from alembic import op

from pathlib import Path
import sys

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

import sqlalchemy as sa
from sqlalchemy import column, String, Text, table
from sqlalchemy.dialects.postgresql import UUID
revision = '0123_tenant_rbac_v2'
down_revision = '0122_inv_item_dept_slug'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_create_table(op, conn, 'rbac_catalog_permissions', sa.Column('key', sa.String(length=160), nullable=False), sa.Column('description', sa.Text(), nullable=True), sa.PrimaryKeyConstraint('key'))
    ah.safe_create_table(op, conn, 'tenant_departments', sa.Column('id', UUID(as_uuid=False), nullable=False), sa.Column('company_id', UUID(as_uuid=False), nullable=False), sa.Column('slug', sa.String(length=64), nullable=False), sa.Column('name', sa.String(length=255), nullable=False), sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False), sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'), sa.PrimaryKeyConstraint('id'), sa.UniqueConstraint('company_id', 'slug', name='uq_tenant_departments_company_slug'))
    ah.safe_create_index(op, conn, 'ix_tenant_departments_company_id', 'tenant_departments', ['company_id'])
    ah.safe_create_table(op, conn, 'tenant_roles', sa.Column('id', UUID(as_uuid=False), nullable=False), sa.Column('company_id', UUID(as_uuid=False), nullable=False), sa.Column('department_id', UUID(as_uuid=False), nullable=False), sa.Column('slug', sa.String(length=96), nullable=False), sa.Column('name', sa.String(length=255), nullable=False), sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False), sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'), sa.ForeignKeyConstraint(['department_id'], ['tenant_departments.id'], ondelete='CASCADE'), sa.PrimaryKeyConstraint('id'), sa.UniqueConstraint('company_id', 'slug', name='uq_tenant_roles_company_slug'))
    ah.safe_create_index(op, conn, 'ix_tenant_roles_company_id', 'tenant_roles', ['company_id'])
    ah.safe_create_index(op, conn, 'ix_tenant_roles_department_id', 'tenant_roles', ['department_id'])
    ah.safe_create_table(op, conn, 'tenant_role_grants', sa.Column('tenant_role_id', UUID(as_uuid=False), nullable=False), sa.Column('permission_key', sa.String(length=160), nullable=False), sa.ForeignKeyConstraint(['tenant_role_id'], ['tenant_roles.id'], ondelete='CASCADE'), sa.ForeignKeyConstraint(['permission_key'], ['rbac_catalog_permissions.key'], ondelete='CASCADE'), sa.PrimaryKeyConstraint('tenant_role_id', 'permission_key'))
    seed = [('work_requests.view', 'View work requests'), ('work_requests.edit', 'Edit work requests'), ('compliance.view', 'View inspections & compliance'), ('inventory.view', 'View inventory'), ('inventory.manage', 'Manage inventory'), ('equipment.view', 'View equipment'), ('procedures.view', 'View procedures / standards'), ('team_insights.view', 'View team insights / analytics'), ('team_management.view', 'Open Team Management'), ('messaging.view', 'View messaging'), ('schedule.view', 'View scheduling / classes'), ('monitoring.view', 'View monitoring'), ('projects.view', 'View projects'), ('drawings.view', 'View drawings'), ('zones_devices.view', 'View zones & devices'), ('live_map.view', 'View live map'), ('arena_advertising.view', 'Arena advertising mapper'), ('social_planner.view', 'Social / campaign planner'), ('publication_pipeline.view', 'Publication pipeline'), ('xplor_indesign.view', 'Xplor → InDesign export'), ('communications_assets.view', 'Communications assets library'), ('workspace.view', 'Open a department workspace hub')]
    perm_table = table('rbac_catalog_permissions', column('key', String), column('description', Text))
    op.bulk_insert(perm_table, [{'key': k, 'description': d} for k, d in seed])
    ah.safe_add_column(op, conn, 'users', sa.Column('tenant_role_id', UUID(as_uuid=False), nullable=True))
    ah.safe_create_foreign_key(op, conn, 'fk_users_tenant_role_id', 'users', 'tenant_roles', ['tenant_role_id'], ['id'], ondelete='SET NULL')
    ah.safe_create_index(op, conn, 'ix_users_tenant_role_id', 'users', ['tenant_role_id'])

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_index(op, conn, 'ix_users_tenant_role_id', 'users')
    ah.safe_drop_constraint(op, conn, 'fk_users_tenant_role_id', 'users', type_='foreignkey')
    ah.safe_drop_column(op, conn, 'users', 'tenant_role_id')
    ah.safe_drop_table(op, conn, 'tenant_role_grants')
    ah.safe_drop_index(op, conn, 'ix_tenant_roles_department_id', 'tenant_roles')
    ah.safe_drop_index(op, conn, 'ix_tenant_roles_company_id', 'tenant_roles')
    ah.safe_drop_table(op, conn, 'tenant_roles')
    ah.safe_drop_index(op, conn, 'ix_tenant_departments_company_id', 'tenant_departments')
    ah.safe_drop_table(op, conn, 'tenant_departments')
    ah.safe_drop_table(op, conn, 'rbac_catalog_permissions')
