"""user profile avatar/job_title/operational_role; company timezone/industry

Revision ID: 0044
Revises: 0043
Create Date: 2026-04-04

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0044"
down_revision = "0043"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_url", sa.String(length=2048), nullable=True))
    op.add_column("users", sa.Column("job_title", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("operational_role", sa.String(length=32), nullable=True))
    op.add_column("companies", sa.Column("timezone", sa.String(length=128), nullable=True))
    op.add_column("companies", sa.Column("industry", sa.String(length=255), nullable=True))

    # Preserve workforce visibility for existing roster users (RBAC roles → operational_role).
    op.execute(
        """
        UPDATE users
        SET operational_role = CASE
            WHEN roles && ARRAY['manager', 'company_admin']::varchar[] THEN 'manager'
            WHEN roles && ARRAY['supervisor']::varchar[] THEN 'supervisor'
            WHEN roles && ARRAY['worker', 'lead']::varchar[] THEN 'worker'
            ELSE NULL
        END
        WHERE company_id IS NOT NULL
          AND (
            roles && ARRAY['worker', 'lead', 'supervisor', 'manager', 'company_admin']::varchar[]
          );
        """
    )


def downgrade() -> None:
    op.drop_column("companies", "industry")
    op.drop_column("companies", "timezone")
    op.drop_column("users", "operational_role")
    op.drop_column("users", "job_title")
    op.drop_column("users", "avatar_url")
