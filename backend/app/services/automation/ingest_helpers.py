"""Idempotency and ingest helpers (keeps routes thin)."""

from __future__ import annotations

import time
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.automation_engine import AutomationEvent

# Wall-clock buckets when device omits `timestamp` (2s window; reduces collisions vs 1:1 duplicates).
_IDEMPOTENCY_FALLBACK_BUCKET_SEC = 2


def build_idempotency_key(payload: dict[str, Any]) -> str:
    """
    Stable dedup key for ESP32 bursts (scoped at persistence via ``company_id`` + unique index).

    When ``timestamp`` is present: second bucket from payload (ms vs s heuristic).
    When missing: ``fb:{gw}:{wm}:{em}:{wall_time // 2s}``.
    """
    gw = str(payload.get("gateway_id") or "")
    wm = str(payload.get("worker_tag_mac") or "")
    em = str(payload.get("equipment_tag_mac") or "")
    ts_raw = payload.get("timestamp")
    if ts_raw is None:
        bucket = int(time.time()) // _IDEMPOTENCY_FALLBACK_BUCKET_SEC
        return f"fb:{gw}:{wm}:{em}:{bucket}"
    ts = float(ts_raw)
    bucket = int(ts // 1000) if ts > 1e11 else int(ts)
    return f"{gw}:{wm}:{em}:{bucket}"


async def find_event_by_idempotency(
    db: AsyncSession,
    *,
    company_id: str,
    idempotency_key: str,
) -> Optional[AutomationEvent]:
    q = await db.execute(
        select(AutomationEvent)
        .where(
            AutomationEvent.company_id == company_id,
            AutomationEvent.idempotency_key == idempotency_key,
        )
        .limit(1)
    )
    return q.scalar_one_or_none()
