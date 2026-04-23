"""
Xplor Recreation API client.

Production goals:
- credentials from env (see `app/core/config.py`)
- small surface area (get facilities, get schedules)
- graceful errors
- mock fallback for local development
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import httpx

from app.core.config import get_settings


class XplorClientError(RuntimeError):
    """Raised when the upstream Xplor API fails."""


@dataclass
class CacheEntry:
    value: Any
    expires_at: float


class SimpleTtlCache:
    """Tiny in-memory TTL cache (single-process)."""

    def __init__(self) -> None:
        self._store: Dict[str, CacheEntry] = {}

    def get(self, key: str) -> Any | None:
        hit = self._store.get(key)
        if not hit:
            return None
        if time.time() >= hit.expires_at:
            self._store.pop(key, None)
            return None
        return hit.value

    def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        ttl = max(1, int(ttl_seconds))
        self._store[key] = CacheEntry(value=value, expires_at=time.time() + ttl)


_cache = SimpleTtlCache()


def _mock_schedules_payload() -> Dict[str, Any]:
    # Use timezone-aware ISO strings.
    now = datetime.now(tz=timezone.utc).astimezone()
    d = now.date().isoformat()
    return {
        "schedules": [
            {
                "id": "mock-1",
                "program_name": "Public Skate",
                "start_time": f"{d}T09:30:00{now.strftime('%z')[:-2]}:{now.strftime('%z')[-2:]}",
                "end_time": f"{d}T10:30:00{now.strftime('%z')[:-2]}:{now.strftime('%z')[-2:]}",
                "location": "Rink A",
                "staff": ["Front Desk", "Ice Lead"],
                "status": "scheduled",
            },
            {
                "id": "mock-2",
                "program_name": "Hockey Practice",
                "start_time": f"{d}T11:00:00{now.strftime('%z')[:-2]}:{now.strftime('%z')[-2:]}",
                "end_time": f"{d}T12:15:00{now.strftime('%z')[:-2]}:{now.strftime('%z')[-2:]}",
                "location": "Rink B",
                "staff": ["Coach", "Ice Tech"],
                "status": "scheduled",
            },
            {
                "id": "mock-3",
                "program_name": "Figure Skating",
                "start_time": f"{d}T14:00:00{now.strftime('%z')[:-2]}:{now.strftime('%z')[-2:]}",
                "end_time": f"{d}T15:30:00{now.strftime('%z')[:-2]}:{now.strftime('%z')[-2:]}",
                "location": "Rink A",
                "staff": ["Coach", "Attendant"],
                "status": "scheduled",
            },
        ]
    }


class XplorClient:
    def __init__(
        self,
        *,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        use_mock_data: Optional[bool] = None,
    ) -> None:
        s = get_settings()
        self.api_key = api_key if api_key is not None else s.xplor_api_key
        self.base_url = (base_url if base_url is not None else s.xplor_base_url).rstrip("/")
        self.use_mock_data = use_mock_data if use_mock_data is not None else s.use_mock_data
        self.cache_ttl = s.schedule_cache_ttl_seconds

    def _headers(self) -> Dict[str, str]:
        # NOTE: Xplor auth scheme may differ; we keep this centralized.
        # Common patterns: "x-api-key" or "Authorization: Bearer".
        if not self.api_key:
            return {}
        return {"x-api-key": self.api_key}

    async def _get(self, path: str, *, params: Dict[str, Any] | None = None) -> Any:
        if self.use_mock_data:
            raise XplorClientError("mock_mode")
        if not self.api_key:
            raise XplorClientError("missing_api_key")
        url = f"{self.base_url}{path}"
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(url, headers=self._headers(), params=params)
                res.raise_for_status()
                return res.json()
        except httpx.HTTPStatusError as e:
            raise XplorClientError(f"upstream_status:{e.response.status_code}") from e
        except httpx.HTTPError as e:
            raise XplorClientError("upstream_network") from e

    async def get_facilities(self) -> Any:
        """
        Fetch facilities.

        Placeholder path; update once you confirm Xplor endpoints.
        """
        cache_key = "xplor:facilities"
        cached = _cache.get(cache_key)
        if cached is not None:
            return cached
        data = await self._get("/facilities")
        _cache.set(cache_key, data, self.cache_ttl)
        return data

    async def get_schedules(self, *, facility_id: str | None = None, date: str | None = None) -> Any:
        """
        Fetch schedules from Xplor.

        Args:
            facility_id: optional filter (implementation depends on upstream API)
            date: YYYY-MM-DD, optional
        """
        cache_key = f"xplor:schedules:{facility_id or 'all'}:{date or 'today'}"
        cached = _cache.get(cache_key)
        if cached is not None:
            return cached

        params: Dict[str, Any] = {}
        if facility_id:
            params["facility_id"] = facility_id
        if date:
            params["date"] = date

        data = await self._get("/schedules", params=params)
        _cache.set(cache_key, data, self.cache_ttl)
        return data

    async def get_schedules_with_fallback(self, *, facility_id: str | None = None, date: str | None = None) -> Any:
        """
        Best-effort schedule fetch:
        - try live (unless USE_MOCK_DATA)
        - if it fails: return cached if present
        - if no cache: return mock payload
        """
        cache_key = f"xplor:schedules:{facility_id or 'all'}:{date or 'today'}"

        try:
            if self.use_mock_data:
                raise XplorClientError("mock_mode")
            return await self.get_schedules(facility_id=facility_id, date=date)
        except Exception:
            cached = _cache.get(cache_key)
            if cached is not None:
                return cached
            return _mock_schedules_payload()

