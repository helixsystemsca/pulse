"""Authoritative tenant_role_assignments table + backfill from HR department/matrix_slot."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "1005_tenant_role_assignments"
down_revision = "1004_matrix_department_baselines"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tenant_role_assignments",
        sa.Column("id", sa.UUID(as_uuid=False), primary_key=True),
        sa.Column("company_id", sa.UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "department_id",
            sa.UUID(as_uuid=False),
            sa.ForeignKey("tenant_departments.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("department_slug", sa.String(64), nullable=False),
        sa.Column("role_key", sa.String(32), nullable=False),
        sa.Column("assigned_by", sa.UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.create_index("ix_tra_company_user", "tenant_role_assignments", ["company_id", "user_id"])
    op.create_index(
        "ix_tra_active_user",
        "tenant_role_assignments",
        ["company_id", "user_id", "active"],
    )

    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            """
            SELECT h.company_id, h.user_id, h.department, h.department_slugs, h.matrix_slot
            FROM pulse_worker_hr h
            """
        )
    ).fetchall()

    def _norm_dept(department: object | None, slugs: object | None) -> str | None:
        allowed = {
            "maintenance",
            "communications",
            "aquatics",
            "reception",
            "fitness",
            "racquets",
            "admin",
        }
        if isinstance(slugs, list):
            for x in slugs:
                s = str(x).strip().lower()
                if s in allowed:
                    return s
        if department:
            s = str(department).strip().lower()
            if s in allowed:
                return s
        return None

    baselines = {
        "maintenance": "operations",
        "communications": "coordination",
        "reception": "coordination",
        "aquatics": "aquatics_staff",
        "fitness": "fitness_staff",
        "racquets": "racquets_staff",
        "admin": "admin_staff",
    }

    for company_id, user_id, department, department_slugs, matrix_slot in rows:
        dept = _norm_dept(department, department_slugs) or "maintenance"
        role = str(matrix_slot).strip().lower() if matrix_slot else ""
        if not role:
            role = baselines.get(dept, "team_member")
        conn.execute(
            sa.text(
                """
                INSERT INTO tenant_role_assignments
                  (id, company_id, user_id, department_slug, role_key, active)
                VALUES
                  (gen_random_uuid(), :cid, :uid, :dept, :role, true)
                """
            ),
            {"cid": company_id, "uid": user_id, "dept": dept, "role": role},
        )


def downgrade() -> None:
    op.drop_index("ix_tra_active_user", table_name="tenant_role_assignments")
    op.drop_index("ix_tra_company_user", table_name="tenant_role_assignments")
    op.drop_table("tenant_role_assignments")
