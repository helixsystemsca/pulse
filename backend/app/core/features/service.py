"""Feature flags: read/write `company_features` rows per tenant."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.company_features import sync_enabled_features, tenant_enabled_feature_names_with_legacy
from app.core.features.cache import get_cached, invalidate, set_cached
from app.core.features.system_catalog import GLOBAL_SYSTEM_FEATURES
from app.models.domain import Company, CompanyFeature

# Canonical module keys (must match /modules, path map, and frontend).
MODULE_KEYS = list(
    dict.fromkeys(
        [
            "tool_tracking",
            "inventory",
            "maintenance",
            "jobs",
            "notifications",
            "analytics",
            *list(GLOBAL_SYSTEM_FEATURES),
        ]
    )
)


class FeatureFlagService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def is_enabled(self, company_id: str, module_key: str) -> bool:
        enabled = await self._frozen_enabled(company_id)
        if module_key == "equipment":
            return "equipment" in enabled or "tool_tracking" in enabled
        return module_key in enabled

    async def _frozen_enabled(self, company_id: str) -> frozenset[str]:
        cached = get_cached(company_id)
        if cached is not None:
            return cached
        company = await self._db.get(Company, company_id)
        if company is None:
            return frozenset()
        names = await tenant_enabled_feature_names_with_legacy(self._db, company_id)
        normalized = frozenset(x for x in names if x in MODULE_KEYS)
        set_cached(company_id, normalized)
        return normalized

    async def set_module(self, company_id: str, module_key: str, enabled: bool) -> None:
        company = await self._db.get(Company, company_id)
        if company is None:
            raise ValueError("company not found")
        have = set(await tenant_enabled_feature_names_with_legacy(self._db, company_id))
        if enabled:
            have.add(module_key)
        else:
            have.discard(module_key)
        await sync_enabled_features(self._db, company_id, sorted(have))
        await self._db.flush()
        invalidate(company_id)

    async def list_for_company(self, company_id: str) -> dict[str, bool]:
        have = await self._frozen_enabled(company_id)
        return {k: k in have for k in MODULE_KEYS}

    async def enabled_list(self, company_id: str) -> list[str]:
        fd = await self._frozen_enabled(company_id)
        return sorted(fd)
