"""Repository-level inventory scope predicates and query helpers."""

from __future__ import annotations

from typing import Any, TypeVar

from sqlalchemy import Select, and_, false, select, true
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from app.core.inventory.policy import EffectiveInventoryPolicy
from app.models.domain import DepartmentInventoryScope, InventoryItem, InventoryScope

_T = TypeVar("_T")


def scope_access_predicate(
    scope_id_column: ColumnElement[Any],
    policy: EffectiveInventoryPolicy,
    *,
    explicit_scope_id: str | None = None,
) -> ColumnElement[bool]:
    """AND onto inventory row queries: readable scopes, optional narrowing for admins."""
    parts: list[ColumnElement[bool]] = []
    if explicit_scope_id:
        parts.append(scope_id_column == explicit_scope_id)
    if policy.is_company_admin:
        return and_(*parts) if parts else true()
    if not policy.readable_scope_ids:
        return false()
    parts.append(scope_id_column.in_(list(policy.readable_scope_ids)))
    return and_(*parts) if len(parts) > 1 else parts[0]


def apply_inventory_scope_filter(
    stmt: Select[_T],
    scope_id_column: ColumnElement[Any],
    policy: EffectiveInventoryPolicy,
    *,
    explicit_scope_id: str | None = None,
) -> Select[_T]:
    return stmt.where(scope_access_predicate(scope_id_column, policy, explicit_scope_id=explicit_scope_id))


async def get_accessible_inventory_items(
    db: AsyncSession,
    company_id: str,
    policy: EffectiveInventoryPolicy,
    *,
    explicit_scope_id: str | None = None,
) -> list[InventoryItem]:
    stmt = select(InventoryItem).where(InventoryItem.company_id == company_id)
    stmt = apply_inventory_scope_filter(stmt, InventoryItem.scope_id, policy, explicit_scope_id=explicit_scope_id)
    stmt = stmt.order_by(InventoryItem.name.asc())
    rows = await db.execute(stmt)
    return list(rows.scalars().all())


def can_read_inventory_item(policy: EffectiveInventoryPolicy, item: InventoryItem) -> bool:
    if policy.is_company_admin:
        return True
    return item.scope_id in policy.readable_scope_ids


def can_write_inventory_item(policy: EffectiveInventoryPolicy, item: InventoryItem) -> bool:
    if policy.is_company_admin:
        return True
    return item.scope_id in policy.writable_scope_ids


def can_transfer_inventory_item_to_scope(
    policy: EffectiveInventoryPolicy,
    *,
    source_item: InventoryItem,
    destination_scope_id: str,
) -> bool:
    if not can_write_inventory_item(policy, source_item):
        return False
    if policy.is_company_admin:
        return True
    return destination_scope_id in policy.transferable_scope_ids


async def ensure_scope_for_company_slug(
    db: AsyncSession,
    company_id: str,
    slug: str,
    *,
    name: str | None = None,
    is_shared: bool = False,
) -> InventoryScope:
    """Idempotently ensure a scope + default department mapping row exist."""
    slug_n = slug.strip().lower()
    existing_q = await db.execute(
        select(InventoryScope).where(InventoryScope.company_id == company_id, InventoryScope.slug == slug_n)
    )
    existing = existing_q.scalar_one_or_none()
    if existing:
        map_q = await db.execute(
            select(DepartmentInventoryScope.id).where(
                DepartmentInventoryScope.company_id == company_id,
                DepartmentInventoryScope.department_slug == slug_n,
                DepartmentInventoryScope.scope_id == existing.id,
            )
        )
        if map_q.scalar_one_or_none() is None:
            db.add(
                DepartmentInventoryScope(
                    company_id=company_id,
                    department_slug=slug_n,
                    scope_id=existing.id,
                )
            )
            await db.flush()
        return existing

    scope = InventoryScope(
        company_id=company_id,
        name=name or slug_n.replace("_", " ").title(),
        slug=slug_n,
        description=None,
        is_shared=is_shared,
    )
    db.add(scope)
    await db.flush()
    db.add(
        DepartmentInventoryScope(
            company_id=company_id,
            department_slug=slug_n,
            scope_id=scope.id,
        )
    )
    await db.flush()
    return scope


async def get_inventory_scope(db: AsyncSession, scope_id: str, company_id: str) -> InventoryScope | None:
    row = await db.get(InventoryScope, scope_id)
    if row is None or row.company_id != company_id:
        return None
    return row
