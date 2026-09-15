"""Ensure City of Vernon has Recreation Ops on-contract and Josh is company admin."""

from __future__ import annotations

import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.features.recreation_ops_tenants import (
    VERNON_ADMIN_EMAILS,
    VERNON_PINNED_FEATURES,
    apply_vernon_default_logo,
    recreation_ops_forced_for_company_name,
)
from app.core.features.service import FeatureFlagService
from app.core.user_roles import user_has_any_role
from app.models.domain import Company, User, UserRole

_log = logging.getLogger("pulse.startup")


async def ensure_vernon_recreation_ops(db: AsyncSession) -> None:
    companies = list((await db.execute(select(Company).where(Company.is_active.is_(True)))).scalars().all())
    vernon = [c for c in companies if recreation_ops_forced_for_company_name(c.name)]
    target_ids = {str(c.id) for c in vernon}

    for company in vernon:
        if apply_vernon_default_logo(company):
            _log.info("Set City of Vernon default logo_url for tenant %s", company.id)

    for email in VERNON_ADMIN_EMAILS:
        row = (
            await db.execute(select(User).where(func.lower(User.email) == email))
        ).scalar_one_or_none()
        if row is None:
            _log.info("Vernon admin %s not found — skip role pin until the account exists", email)
            continue
        if row.company_id:
            target_ids.add(str(row.company_id))
        elif vernon:
            row.company_id = vernon[0].id
            target_ids.add(str(vernon[0].id))
        if not user_has_any_role(row, UserRole.company_admin):
            roles = [str(r) for r in (row.roles or []) if str(r).strip()]
            if UserRole.company_admin.value not in roles:
                row.roles = [*roles, UserRole.company_admin.value]
                _log.info("Pinned %s as company_admin for Recreation Ops", email)

    svc = FeatureFlagService(db)
    for cid in target_ids:
        for feat in VERNON_PINNED_FEATURES:
            if not await svc.is_enabled(cid, feat):
                await svc.set_module(cid, feat, True)
                _log.info("Enabled %s for tenant %s", feat, cid)

    try:
        from app.core.vernon_starter_seed import seed_vernon_starter_pack

        for cid in target_ids:
            await seed_vernon_starter_pack(db, cid)
    except Exception:
        _log.exception("Vernon starter seed failed for %s", target_ids)

    await db.commit()
