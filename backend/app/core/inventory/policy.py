"""Resolve effective inventory scope access from RBAC, HR departments, and mappings."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permission_feature_matrix import permission_matrix_department_for_user
from app.core.rbac.resolve import effective_rbac_permission_keys
from app.core.tenant_feature_access import contract_and_effective_features_for_me
from app.core.user_roles import user_has_any_role, user_has_tenant_full_admin
from app.core.workspace_departments import normalize_workspace_department_slug, normalize_workspace_department_slug_list
from app.models.domain import DepartmentInventoryScope, InventoryScope, User, UserRole
from app.models.pulse_models import PulseWorkerHR


@dataclass
class InventoryScopeOverrides:
    """Future hook: explicit grants/denials layered on HR-derived scopes."""

    extra_readable_scope_ids: frozenset[str] = frozenset()
    extra_writable_scope_ids: frozenset[str] = frozenset()
    deny_scope_ids: frozenset[str] = frozenset()


@dataclass
class EffectiveInventoryPolicy:
    readable_scope_ids: set[str]
    writable_scope_ids: set[str]
    transferable_scope_ids: set[str]
    is_company_admin: bool = False


def _authorized_company_context(user: User, company_id: str) -> bool:
    if user.is_system_admin or user_has_any_role(user, UserRole.system_admin):
        return True
    return user.company_id is not None and str(user.company_id) == company_id


async def _all_company_scope_ids(db: AsyncSession, company_id: str) -> set[str]:
    q = await db.execute(select(InventoryScope.id).where(InventoryScope.company_id == company_id))
    return {str(r[0]) for r in q.all()}


async def _scope_ids_for_department_slugs(
    db: AsyncSession,
    company_id: str,
    department_slugs: set[str],
) -> set[str]:
    if not department_slugs:
        return set()
    slugs_t = tuple(department_slugs)
    mapped = await db.execute(
        select(DepartmentInventoryScope.scope_id).where(
            DepartmentInventoryScope.company_id == company_id,
            DepartmentInventoryScope.department_slug.in_(slugs_t),
        )
    )
    out = {str(r[0]) for r in mapped.all()}
    direct = await db.execute(
        select(InventoryScope.id).where(
            InventoryScope.company_id == company_id,
            InventoryScope.slug.in_(slugs_t),
        )
    )
    out |= {str(r[0]) for r in direct.all()}
    return out


def _department_slugs_from_hr_and_matrix(user: User, hr: PulseWorkerHR | None) -> set[str]:
    slugs: set[str] = set()
    if hr is not None:
        raw_ds = getattr(hr, "department_slugs", None)
        if isinstance(raw_ds, list):
            slugs.update(normalize_workspace_department_slug_list([str(x) for x in raw_ds]))
        one = normalize_workspace_department_slug((getattr(hr, "department", None) or "").strip() or None)
        if one:
            slugs.add(one)
    if not slugs:
        dept = permission_matrix_department_for_user(user, hr)
        if dept:
            slugs.add(dept)
    return slugs


def _apply_overrides(base_read: set[str], base_write: set[str], ov: InventoryScopeOverrides | None) -> tuple[set[str], set[str]]:
    if ov is None:
        return base_read, base_write
    read = set(base_read) | set(ov.extra_readable_scope_ids)
    write = set(base_write) | set(ov.extra_writable_scope_ids)
    deny = set(ov.deny_scope_ids)
    read -= deny
    write -= deny
    write &= read
    return read, write


async def resolve_effective_inventory_policy(
    db: AsyncSession,
    user: User,
    company_id: str,
    *,
    overrides: InventoryScopeOverrides | None = None,
) -> EffectiveInventoryPolicy:
    empty = EffectiveInventoryPolicy(set(), set(), set(), False)
    if not _authorized_company_context(user, company_id):
        return empty

    contract, eff, _, _ = await contract_and_effective_features_for_me(db, user)
    rbac_keys = set(
        await effective_rbac_permission_keys(
            db,
            user,
            contract_feature_names=contract,
            effective_feature_names=eff,
        )
    )
    has_inventory_access = "*" in rbac_keys or "inventory.view" in rbac_keys or "inventory.manage" in rbac_keys
    has_manage = "*" in rbac_keys or "inventory.manage" in rbac_keys

    if not has_inventory_access:
        return empty

    is_company_admin = (
        bool(user.is_system_admin)
        or user_has_any_role(user, UserRole.system_admin)
        or user_has_tenant_full_admin(user)
    )

    all_ids = await _all_company_scope_ids(db, company_id)

    if is_company_admin:
        read = set(all_ids)
        write = set(all_ids)
        read, write = _apply_overrides(read, write, overrides)
        xfer = set(write)
        return EffectiveInventoryPolicy(read, write, xfer, True)

    hr_row = await db.execute(select(PulseWorkerHR).where(PulseWorkerHR.user_id == user.id))
    hr = hr_row.scalar_one_or_none()

    dept_slugs = _department_slugs_from_hr_and_matrix(user, hr)
    read = await _scope_ids_for_department_slugs(db, company_id, dept_slugs)
    write = set(read) if has_manage else set()
    xfer = set(write)

    read, write = _apply_overrides(read, write, overrides)
    xfer = set(write)
    return EffectiveInventoryPolicy(read, write, xfer, False)
