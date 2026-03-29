"""Normalized per-tenant feature flags (`company_features` table)."""

from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.features.system_catalog import normalize_enabled_features
from app.models.domain import CompanyFeature


async def sync_enabled_features(db: AsyncSession, company_id: str, requested: list[str]) -> None:
    """Replace all enabled feature rows for a company (only `enabled=True` rows are stored)."""
    names = normalize_enabled_features(requested)
    await db.execute(delete(CompanyFeature).where(CompanyFeature.company_id == company_id))
    for name in names:
        db.add(CompanyFeature(company_id=company_id, feature_name=name, enabled=True))
    await db.flush()


async def list_enabled_names(db: AsyncSession, company_id: str) -> list[str]:
    q = await db.execute(
        select(CompanyFeature.feature_name).where(
            CompanyFeature.company_id == company_id,
            CompanyFeature.enabled.is_(True),
        )
    )
    return sorted({row[0] for row in q.all()})
