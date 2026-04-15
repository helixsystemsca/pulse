"""Normalized per-tenant feature flags (`company_features` table)."""

from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.features.system_catalog import normalize_enabled_features
from app.models.domain import CompanyFeature

# Stored when `sync_enabled_features` runs with zero catalog features so the tenant is not
# mistaken for a pre–feature-gates company (which has no rows and still gets legacy defaults).
_TENANT_EMPTY_FEATURES_MARKER = "_tenant_empty_feature_canvas"


# When a company has no rows yet, treat product modules as on (pre‑gates behavior).
_LEGACY_DEFAULT_PRODUCT_FEATURES: tuple[str, ...] = (
    "compliance",
    "schedule",
    "monitoring",
    "projects",
    "work_orders",
    "workers",
    "inventory",
    "equipment",
    "floor_plan",
)


async def sync_enabled_features(db: AsyncSession, company_id: str, requested: list[str]) -> None:
    """Replace all enabled feature rows for a company (only `enabled=True` rows are stored)."""
    names = normalize_enabled_features(requested)
    await db.execute(delete(CompanyFeature).where(CompanyFeature.company_id == company_id))
    for name in names:
        db.add(CompanyFeature(company_id=company_id, feature_name=name, enabled=True))
    if not names:
        db.add(
            CompanyFeature(
                company_id=company_id,
                feature_name=_TENANT_EMPTY_FEATURES_MARKER,
                enabled=True,
            )
        )
    await db.flush()


async def list_enabled_names(db: AsyncSession, company_id: str) -> list[str]:
    q = await db.execute(
        select(CompanyFeature.feature_name).where(
            CompanyFeature.company_id == company_id,
            CompanyFeature.enabled.is_(True),
        )
    )
    return sorted({row[0] for row in q.all()})


async def company_has_any_feature_row(db: AsyncSession, company_id: str) -> bool:
    q = await db.execute(
        select(CompanyFeature.id).where(CompanyFeature.company_id == company_id).limit(1)
    )
    return q.scalar_one_or_none() is not None


async def tenant_enabled_feature_names_with_legacy(db: AsyncSession, company_id: str) -> list[str]:
    """Enabled names, or default product modules if the company has never had feature rows."""
    if not await company_has_any_feature_row(db, company_id):
        return list(_LEGACY_DEFAULT_PRODUCT_FEATURES)
    return await list_enabled_names(db, company_id)
