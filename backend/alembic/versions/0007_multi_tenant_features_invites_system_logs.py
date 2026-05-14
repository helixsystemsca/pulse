"""Multi-tenant SaaS alignment: company_features, invites, system_logs, last_login.

Revision ID: 0007
Revises: 0006
Create Date: 2026-03-29

"""

from pathlib import Path
import sys

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import JSONB, UUID

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    if not ah.table_exists(conn, "company_features"):
        op.create_table(
            "company_features",
            sa.Column("id", UUID(as_uuid=False), primary_key=True),
            sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
            sa.Column("feature_name", sa.String(128), nullable=False),
            sa.Column("enabled", sa.Boolean(), nullable=False, server_default="true"),
            sa.UniqueConstraint("company_id", "feature_name", name="uq_company_features_company_feature"),
        )
        op.create_index("ix_company_features_company_id", "company_features", ["company_id"])

    if ah.column_exists(conn, "companies", "enabled_features"):
        op.execute(
            text(
                """
                INSERT INTO company_features (id, company_id, feature_name, enabled)
                SELECT gen_random_uuid(), c.id, elem, true
                FROM companies c
                CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(c.enabled_features, '[]'::jsonb)) AS elem
                ON CONFLICT (company_id, feature_name) DO NOTHING
                """
            )
        )
        op.drop_column("companies", "enabled_features")

    if not ah.table_exists(conn, "invites"):
        op.create_table(
            "invites",
            sa.Column("id", UUID(as_uuid=False), primary_key=True),
            sa.Column("email", sa.String(320), nullable=False),
            sa.Column("role", sa.String(32), nullable=False),
            sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
            sa.Column("token_hash", sa.String(128), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("used", sa.Boolean(), nullable=False, server_default="false"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("created_by_user_id", UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        )
        op.create_index("ix_invites_email", "invites", ["email"])
        op.create_index("ix_invites_company_id", "invites", ["company_id"])
        op.create_index("ix_invites_token_hash", "invites", ["token_hash"], unique=True)

        op.execute(
            text(
                """
                INSERT INTO invites (
                    id, email, role, company_id, token_hash, expires_at, used, created_at, created_by_user_id
                )
                SELECT
                    id,
                    COALESCE(email, ''),
                    COALESCE(role, 'company_admin'),
                    company_id,
                    token_hash,
                    expires_at,
                    (used_at IS NOT NULL),
                    created_at,
                    created_by_user_id
                FROM system_secure_tokens
                WHERE kind = 'company_admin_invite'
                """
            )
        )
        op.execute(text("DELETE FROM system_secure_tokens WHERE kind = 'company_admin_invite'"))

    if ah.table_exists(conn, "system_logs") and ah.column_exists(conn, "system_logs", "actor_user_id"):
        op.execute(text("ALTER TABLE system_logs RENAME COLUMN actor_user_id TO performed_by"))
        op.add_column("system_logs", sa.Column("target_type", sa.String(32), nullable=True))
        op.add_column("system_logs", sa.Column("target_id", sa.String(64), nullable=True))
        op.execute(
            text(
                """
                UPDATE system_logs SET
                    target_type = CASE
                        WHEN target_company_id IS NOT NULL THEN 'company'
                        WHEN target_user_id IS NOT NULL THEN 'user'
                        ELSE NULL
                    END,
                    target_id = COALESCE(target_company_id::text, target_user_id::text)
                """
            )
        )
        op.execute(
            text("ALTER TABLE system_logs DROP CONSTRAINT IF EXISTS system_logs_target_company_id_fkey")
        )
        op.execute(text("ALTER TABLE system_logs DROP CONSTRAINT IF EXISTS system_logs_target_user_id_fkey"))
        op.drop_column("system_logs", "target_company_id")
        op.drop_column("system_logs", "target_user_id")
        op.execute(text("ALTER TABLE system_logs RENAME COLUMN created_at TO logged_at"))

    # 0001 create_all uses current metadata, which may define both `last_login` and `last_active_at`.
    # Legacy DBs had only `last_active_at`; 0007 renamed it to `last_login`. If both exist, merge then drop duplicate.
    if ah.column_exists(conn, "users", "last_active_at"):
        if ah.column_exists(conn, "users", "last_login"):
            op.execute(
                text("UPDATE users SET last_login = COALESCE(last_login, last_active_at)")
            )
            op.drop_column("users", "last_active_at")
        else:
            op.execute(text("ALTER TABLE users RENAME COLUMN last_active_at TO last_login"))


def downgrade() -> None:
    conn = op.get_bind()
    if ah.column_exists(conn, "users", "last_login") and not ah.column_exists(conn, "users", "last_active_at"):
        op.execute(text("ALTER TABLE users RENAME COLUMN last_login TO last_active_at"))

    op.execute(text("ALTER TABLE system_logs RENAME COLUMN logged_at TO created_at"))
    op.add_column(
        "system_logs",
        sa.Column("target_company_id", UUID(as_uuid=False), nullable=True),
    )
    op.add_column(
        "system_logs",
        sa.Column("target_user_id", UUID(as_uuid=False), nullable=True),
    )
    op.execute(
        text(
            """
            UPDATE system_logs SET
                target_company_id = CASE WHEN target_type = 'company' THEN target_id::uuid ELSE NULL END,
                target_user_id = CASE WHEN target_type = 'user' THEN target_id::uuid ELSE NULL END
            """
        )
    )
    op.create_foreign_key(
        "system_logs_target_company_id_fkey",
        "system_logs",
        "companies",
        ["target_company_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "system_logs_target_user_id_fkey",
        "system_logs",
        "users",
        ["target_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.drop_column("system_logs", "target_type")
    op.drop_column("system_logs", "target_id")
    op.execute(text("ALTER TABLE system_logs RENAME COLUMN performed_by TO actor_user_id"))

    op.execute(
        text(
            """
            INSERT INTO system_secure_tokens (
                id, kind, token_hash, email, user_id, company_id, role, expires_at, used_at,
                created_by_user_id, created_at
            )
            SELECT
                id,
                'company_admin_invite',
                token_hash,
                NULLIF(email, ''),
                NULL,
                company_id,
                role,
                expires_at,
                CASE WHEN used THEN NOW() ELSE NULL END,
                created_by_user_id,
                created_at
            FROM invites
            """
        )
    )
    op.drop_index("ix_invites_token_hash", table_name="invites")
    op.drop_index("ix_invites_company_id", table_name="invites")
    op.drop_index("ix_invites_email", table_name="invites")
    op.drop_table("invites")

    op.add_column(
        "companies",
        sa.Column("enabled_features", JSONB(), server_default=sa.text("'[]'::jsonb"), nullable=False),
    )
    op.execute(
        text(
            """
            UPDATE companies c SET enabled_features = COALESCE(
                (SELECT jsonb_agg(cf.feature_name ORDER BY cf.feature_name)
                 FROM company_features cf
                 WHERE cf.company_id = c.id AND cf.enabled = true),
                '[]'::jsonb
            )
            """
        )
    )
    op.drop_index("ix_company_features_company_id", table_name="company_features")
    op.drop_table("company_features")
