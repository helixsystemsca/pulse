"""Remove club departments seeded by 1031 when unused by roles or HR."""

from __future__ import annotations

import alembic_helpers as ah
import sqlalchemy as sa
from alembic import op

revision = "1044_trim_unreferenced_club_departments"
down_revision = "1043_team_management_workspace"
branch_labels = None
depends_on = None

# Club / recreation departments — not part of the default tenant bootstrap anymore.
_CLUB_SLUGS = ("aquatics", "fitness", "racquets", "reception")


def upgrade() -> None:
    conn = op.get_bind()
    if not ah.table_exists(conn, "tenant_departments"):
        return

    conn.execute(
        sa.text(
            """
            DELETE FROM tenant_departments td
            WHERE td.slug = ANY(:slugs)
              AND NOT EXISTS (
                SELECT 1 FROM tenant_roles tr WHERE tr.department_id = td.id
              )
              AND NOT EXISTS (
                SELECT 1 FROM tenant_role_assignments tra
                WHERE tra.company_id = td.company_id
                  AND lower(trim(tra.department_slug)) = td.slug
              )
              AND NOT EXISTS (
                SELECT 1 FROM pulse_worker_hr hr
                WHERE hr.company_id = td.company_id
                  AND lower(trim(coalesce(hr.department, ''))) = td.slug
              )
            """
        ),
        {"slugs": list(_CLUB_SLUGS)},
    )


def downgrade() -> None:
    # Non-destructive: removed rows are not restored automatically.
    pass
