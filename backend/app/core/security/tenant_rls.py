"""PostgreSQL session variables for tenant Row Level Security (defense-in-depth)."""

from __future__ import annotations

import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.domain import User
from app.core.user_roles import user_has_any_role
from app.models.domain import UserRole

_log = logging.getLogger("pulse.security.rls")


async def apply_pulse_rls_context(
    db: AsyncSession,
    *,
    company_id: str | None,
    is_system_admin: bool,
) -> None:
    """
    Set transaction-local GUCs consumed by RLS policies (migration 1021).

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


async def apply_pulse_rls_system_context(db: AsyncSession) -> None:
    """Cron / cross-tenant maintenance jobs that must read all tenants."""
    await apply_pulse_rls_context(db, company_id=None, is_system_admin=True)


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
