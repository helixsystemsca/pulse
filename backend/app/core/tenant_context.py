"""Shared tenant (company) resolution and request logging."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import HTTPException, status

from app.core.user_roles import user_has_any_role
from app.models.domain import User, UserRole

_log = logging.getLogger(__name__)


def log_tenant_context(
    *,
    user_id: str,
    tenant_id: str | None,
    path: str | None = None,
    company_id_query: str | None = None,
) -> None:
    _log.info(
        "Tenant context",
        extra={
            "user_id": user_id,
            "tenant_id": tenant_id,
            "path": path,
            "company_id_query": company_id_query,
        },
    )


def resolve_tenant_company_id(
    user: User,
    company_id: Optional[str],
    *,
    path: str | None = None,
) -> str:
    """
    Resolve active tenant for API routes.

    - Tenant users: JWT + DB ``user.company_id`` (must match optional query param).
    - System admins: ``company_id`` query param is required.
    """
    if user_has_any_role(user, UserRole.system_admin) or user.is_system_admin:
        if not company_id:
            raise HTTPException(
                status_code=400,
                detail="company_id is required for system administrators",
            )
        log_tenant_context(
            user_id=str(user.id),
            tenant_id=company_id,
            path=path,
            company_id_query=company_id,
        )
        return company_id

    if user.company_id is None:
        raise HTTPException(status_code=403, detail="Not a tenant user")

    cid = str(user.company_id)
    if company_id is not None and company_id != cid:
        raise HTTPException(status_code=403, detail="Company access denied")

    log_tenant_context(
        user_id=str(user.id),
        tenant_id=cid,
        path=path,
        company_id_query=company_id,
    )
    return cid
