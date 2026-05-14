"""Test helpers for persisted tenant role assignment (avoids FK violations)."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tenant_roles import assign_user_tenant_role, create_or_fetch_tenant_role, ensure_baseline_tenant_roles
from app.models.domain import User
from app.models.rbac_models import TenantRole

__all__ = [
    "assign_user_tenant_role",
    "create_or_fetch_tenant_role",
    "ensure_baseline_tenant_roles",
]


async def assign_worker_no_access_role(
    db: AsyncSession,
    *,
    company_id: str,
    user: User,
    contract_names: list[str] | None = None,
) -> TenantRole:
    """Create/reuse the ``no_access`` role and assign it to ``user`` (role row flushed first)."""
    baseline = await ensure_baseline_tenant_roles(db, company_id, contract_names=contract_names)
    role = baseline["no_access"]
    await assign_user_tenant_role(db, user, role)
    return role
