"""PostgreSQL session variables for tenant Row Level Security (defense-in-depth)."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from sqlalchemy import text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.domain import User
from app.core.user_roles import user_has_any_role
from app.models.domain import UserRole

_log = logging.getLogger("pulse.security.rls")

# Session-scoped (survives Alembic transaction_per_migration + helper commits).
_SYSTEM_CONTEXT_SESSION_SQL = text(
    "SELECT set_config('pulse.company_id', '', false), "
    "set_config('pulse.is_system_admin', 'true', false)"
)


async def apply_pulse_rls_context(
    db: AsyncSession,
    *,
    company_id: str | None,
    is_system_admin: bool,
) -> None:
    """
    Set transaction-local GUCs consumed by RLS policies (migrations 1021 / 1023 / 1051).

    Policies use ``pulse.company_id`` and ``pulse.is_system_admin``. When context is unset,
    tenant rows are hidden unless the DB role bypasses RLS (e.g. superuser / BYPASSRLS).
    """
    settings = get_settings()
    if not settings.database_rls_context_enabled:
        return
    cid = (company_id or "").strip()
    adm = "true" if is_system_admin else "false"
    await db.execute(
        text(
            "SELECT set_config('pulse.company_id', :cid, true), "
            "set_config('pulse.is_system_admin', :adm, true)"
        ),
        {"cid": cid, "adm": adm},
    )


async def apply_pulse_rls_context_for_user(db: AsyncSession, user: User) -> None:
    is_sys = user_has_any_role(user, UserRole.system_admin) or bool(user.is_system_admin)
    cid = None if is_sys else (str(user.company_id) if user.company_id else None)
    await apply_pulse_rls_context(db, company_id=cid, is_system_admin=is_sys)


async def apply_pulse_rls_context_for_login_user(db: AsyncSession, user: User) -> None:
    """
    After an auth bootstrap lookup: scope to the tenant, or keep system GUCs.

    Unassigned accounts (``company_id`` IS NULL, not system admin) are not visible
    under tenant policies; leaving bootstrap context lets lockout/audit/login_events
    writes succeed without widening ``users`` policies.
    """
    is_sys = user_has_any_role(user, UserRole.system_admin) or bool(user.is_system_admin)
    if is_sys or not user.company_id:
        await apply_pulse_rls_system_context(db)
        return
    await apply_pulse_rls_context_for_user(db, user)


async def apply_pulse_rls_context_for_auth_write(
    db: AsyncSession, user: User | None = None
) -> None:
    """
    Set GUCs immediately before auth INSERT/UPDATE under FORCE RLS.

    Production outage (``pulse_app``): ``sqlalchemy.exc.ProgrammingError`` on
    ``INSERT INTO audit_logs`` during password login when ``pulse.*`` GUCs were
    empty. Unknown-email / platform-global audits use system-admin context
    (nullable ``company_id``). Identified users use tenant context so
    ``audit_logs`` and ``login_events`` WITH CHECK policies pass.
    """
    if user is None:
        await apply_pulse_rls_auth_bootstrap_context(db)
        return
    await apply_pulse_rls_context_for_login_user(db, user)


async def apply_pulse_rls_system_context(db: AsyncSession) -> None:
    """Cron / cross-tenant maintenance jobs that must read all tenants."""
    await apply_pulse_rls_context(db, company_id=None, is_system_admin=True)


async def apply_pulse_rls_auth_bootstrap_context(db: AsyncSession) -> None:
    """
    Unauthenticated auth: look up users/tokens before a tenant GUC exists.

    FORCE RLS + ``pulse_app`` (NOBYPASSRLS) hides every tenant row when GUCs are
    empty, so ``SELECT users WHERE email=…`` returns nothing and
    ``INSERT INTO audit_logs`` raises ``ProgrammingError`` (HTTP 500). Same for
    ``login_events`` and lockout column updates.

    Call this for the brief identity lookup, then ``apply_pulse_rls_context_for_login_user``
    once the principal is known (tenant users) or keep this context for
    platform-global rows (``company_id`` IS NULL, ``system_logs``).
    """
    await apply_pulse_rls_system_context(db)


def apply_pulse_rls_system_context_sync(conn: Connection) -> None:
    """
    Session-level system-admin GUCs for Alembic / sync DDL connections.

    Always applied (does not honor ``DATABASE_RLS_CONTEXT_ENABLED``). Catalog tables
    use FORCE RLS; a non-superuser owner still needs ``pulse.is_system_admin=true``.
    Session-scoped so values survive ``transaction_per_migration`` and helper commits.
    """
    conn.execute(_SYSTEM_CONTEXT_SESSION_SQL)


@asynccontextmanager
async def pulse_rls_system_admin_scope(db: AsyncSession) -> AsyncIterator[None]:
    """Set system-admin GUCs for catalog/seed writes, then restore prior context."""
    settings = get_settings()
    if not settings.database_rls_context_enabled:
        yield
        return
    row = (
        await db.execute(
            text(
                "SELECT current_setting('pulse.company_id', true), "
                "current_setting('pulse.is_system_admin', true)"
            )
        )
    ).one()
    await apply_pulse_rls_system_context(db)
    try:
        yield
    finally:
        await apply_pulse_rls_context(
            db,
            company_id=row[0] or None,
            is_system_admin=(row[1] == "true"),
        )


async def clear_pulse_rls_context(db: AsyncSession) -> None:
    settings = get_settings()
    if not settings.database_rls_context_enabled:
        return
    await db.execute(
        text(
            "SELECT set_config('pulse.company_id', '', true), "
            "set_config('pulse.is_system_admin', 'false', true)"
        )
    )
