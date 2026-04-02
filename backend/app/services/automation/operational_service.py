"""Read models and actions for operational / debug APIs."""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.automation_engine import (
    AutomationEvent,
    AutomationLog,
    AutomationNotification,
    AutomationStateTracking,
)
from app.models.device_hub import AutomationGateway
from app.services.automation.internal_event_pipeline import ingest_internal_event

_PREVIEW_KEYS = frozenset(
    {
        "company_id",
        "worker_id",
        "equipment_id",
        "zone_id",
        "gateway_id",
        "distance",
        "movement",
        "timestamp",
        "rate_limited",
        "notification_id",
        "reason",
        "duration_seconds",
        "entity_key",
        "source_automation_event_id",
        "session_end_reason",
    }
)


def _slim_payload(payload: dict[str, Any]) -> dict[str, Any]:
    if not payload:
        return {}
    slim = {k: payload[k] for k in _PREVIEW_KEYS if k in payload}
    extra = len(payload) - len(slim)
    if extra > 0:
        slim["_truncated_keys"] = extra
    return slim


async def fetch_recent_activity(
    db: AsyncSession,
    *,
    company_id: str,
    limit: int = 50,
) -> dict[str, Any]:
    lid = min(max(limit, 1), 100)

    ev_rows = (
        (
            await db.execute(
                select(AutomationEvent)
                .where(AutomationEvent.company_id == company_id)
                .order_by(desc(AutomationEvent.created_at))
                .limit(lid)
            )
        )
        .scalars()
        .all()
    )

    log_rows = (
        (
            await db.execute(
                select(AutomationLog)
                .where(AutomationLog.company_id == company_id)
                .order_by(desc(AutomationLog.created_at))
                .limit(lid)
            )
        )
        .scalars()
        .all()
    )

    st_rows = (
        (
            await db.execute(
                select(AutomationStateTracking)
                .where(AutomationStateTracking.company_id == company_id)
                .order_by(desc(AutomationStateTracking.updated_at))
                .limit(lid)
            )
        )
        .scalars()
        .all()
    )

    return {
        "events": [
            {
                "id": r.id,
                "event_type": r.event_type,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "payload": _slim_payload(dict(r.payload or {})),
            }
            for r in ev_rows
        ],
        "logs": [
            {
                "id": r.id,
                "type": r.type,
                "severity": r.severity,
                "source_module": r.source_module,
                "message": r.message[:500] if r.message else "",
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "payload": _slim_payload(dict(r.payload or {})),
            }
            for r in log_rows
        ],
        "active_states": [
            {
                "id": r.id,
                "entity_key": r.entity_key,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
                "state": (
                    dict(r.state or {})
                    if len(str(r.state or {})) <= 8000
                    else {"_note": "state too large for preview; use /automation/debug/state"}
                ),
            }
            for r in st_rows
        ],
    }


async def fetch_entity_state(
    db: AsyncSession,
    *,
    company_id: str,
    worker_id: Optional[str],
    equipment_id: Optional[str],
) -> dict[str, Any]:
    if not (worker_id and str(worker_id).strip() and equipment_id and str(equipment_id).strip()):
        return {"state": {}, "last_updated": None, "entity_key": None}

    w = str(worker_id).strip()
    e = str(equipment_id).strip()
    entity_key = f"worker:{w}|equipment:{e}"

    q = await db.execute(
        select(AutomationStateTracking).where(
            AutomationStateTracking.company_id == company_id,
            AutomationStateTracking.entity_key == entity_key,
        )
    )
    row = q.scalar_one_or_none()
    if not row:
        return {"state": {}, "last_updated": None, "entity_key": entity_key}

    return {
        "entity_key": entity_key,
        "state": dict(row.state or {}),
        "last_updated": row.updated_at.isoformat() if row.updated_at else None,
    }


def _gateway_seconds_since(ts: Optional[datetime]) -> Optional[float]:
    if ts is None:
        return None
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return max(0.0, (datetime.now(timezone.utc) - ts).total_seconds())


async def list_gateway_operational_status(
    db: AsyncSession,
    *,
    company_id: str,
    offline_after_seconds: float = 10.0,
) -> list[dict[str, Any]]:
    q = await db.execute(
        select(AutomationGateway).where(AutomationGateway.company_id == company_id).order_by(AutomationGateway.name)
    )
    rows = q.scalars().all()
    out: list[dict[str, Any]] = []
    for g in rows:
        last = g.last_seen_at
        sec = _gateway_seconds_since(last)
        online = sec is not None and sec <= offline_after_seconds
        out.append(
            {
                "id": g.id,
                "name": g.name,
                "zone_id": str(g.zone_id) if g.zone_id else None,
                "status": "online" if online else "offline",
                "last_seen_at": last.isoformat() if last else None,
                "seconds_since_last_seen": round(sec, 3) if sec is not None else None,
            }
        )
    return out


async def acknowledge_notification(
    db: AsyncSession,
    *,
    company_id: str,
    notification_id: str,
    actor_user_id: str,
) -> dict[str, Any]:
    q = await db.execute(
        select(AutomationNotification).where(
            AutomationNotification.id == notification_id,
            AutomationNotification.company_id == company_id,
        )
    )
    row = q.scalar_one_or_none()
    if row is None:
        return {"ok": False, "error": "not_found"}

    if row.status == "acknowledged":
        return {"ok": True, "already_acknowledged": True, "automation_event_id": None}

    row.status = "acknowledged"
    await db.flush()

    evt = await ingest_internal_event(
        db,
        company_id=company_id,
        event_type="notification_acknowledged",
        payload={
            "worker_id": str(row.user_id),
            "notification_id": row.id,
            "timestamp": time.time(),
            "acknowledged_by_user_id": str(actor_user_id),
        },
    )
    await db.flush()
    return {"ok": True, "already_acknowledged": False, "automation_event_id": evt.id}
