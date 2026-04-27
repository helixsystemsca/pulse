"""
Telemetry ingest: RPI5 posts batched RSSI readings from ESP32 gateways.

Auth: X-Gateway-Id (UUID) + Bearer <ingest_secret> — same pattern as device_ingest_routes.py.
The RPI5 sends one POST per gateway, per publish cycle (typically every 2s).

Payload shape:
    {
        "readings": [
            {"mac": "AA:BB:CC:DD:EE:FF", "rssi": -65, "ts": 1714000000.0},
            ...
        ],
        "computed_positions": [          # optional — if RPI5 has done trilateration locally
            {"mac": "AA:BB:CC:DD:EE:FF", "x_norm": 0.42, "y_norm": 0.31},
            ...
        ]
    }

What this endpoint does:
    1. Authenticates the gateway (X-Gateway-Id + Bearer secret, same as /device/events).
    2. Resolves each MAC → AutomationBleDevice (registered) or AutomationUnknownDevice (new).
    3. Upserts beacon_positions for every registered beacon with a computed position.
       - If RPI5 sends computed_positions, use those directly.
       - If only raw RSSI readings, store them for the position engine to process
         (position engine runs as a background task on the RPI5 side).
    4. Updates AutomationGateway.last_seen_at so the Devices tab shows "online".
    5. For each worker beacon that now has a position, fires a proximity_update
       automation event so the existing proximity_logic.py + gateway_arbitration.py
       pipeline runs and handles the maintenance inference.
    6. Returns accepted counts for monitoring.
"""

from __future__ import annotations

import logging
import time
import asyncio
from datetime import datetime, timezone
from typing import Annotated, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.auth.security import verify_password
from app.core.config import get_settings
from app.models.device_hub import AutomationBleDevice, AutomationGateway, AutomationUnknownDevice
from app.schemas.automation_engine import AutomationEventAccepted, AutomationEventIn
from app.services.automation.ingest_pipeline import ingest_automation_event
from app.services.devices.device_service import DeviceService, normalize_mac

logger = logging.getLogger("telemetry.ingest")

router = APIRouter(prefix="/telemetry", tags=["telemetry-ingest"])

# In-process token bucket (best-effort; per-worker). Caps total readings/sec per gateway.
_rl_lock = asyncio.Lock()
_rl_windows: dict[str, tuple[int, int]] = {}  # {gateway_id: (epoch_sec, used_readings)}


async def _enforce_gateway_rate_limit(*, gateway_id: str, readings: int) -> None:
    settings = get_settings()
    limit = int(getattr(settings, "telemetry_ingest_max_readings_per_sec", 0) or 0)
    if limit <= 0:
        return
    now_s = int(time.time())
    async with _rl_lock:
        win_s, used = _rl_windows.get(gateway_id, (now_s, 0))
        if win_s != now_s:
            win_s, used = now_s, 0
        if used + readings > limit:
            _rl_windows[gateway_id] = (win_s, used)
            raise HTTPException(status_code=429, detail="rate_limited")
        _rl_windows[gateway_id] = (win_s, used + readings)


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class RssiReading(BaseModel):
    """Single BLE advertisement as heard by the ESP32."""
    mac: str = Field(..., min_length=12, max_length=17, description="Raw MAC (will be normalized)")
    rssi: int = Field(..., ge=-120, le=0)
    ts: Optional[float] = Field(None, description="Unix timestamp from ESP32 (seconds). Falls back to server time.")


class ComputedPosition(BaseModel):
    """Pre-computed (x, y) position from RPI5 trilateration. Normalized 0.0–1.0 on floor plan."""
    mac: str = Field(..., min_length=12, max_length=17)
    x_norm: float = Field(..., ge=0.0, le=1.0)
    y_norm: float = Field(..., ge=0.0, le=1.0)
    position_confidence: Optional[float] = Field(None, ge=0.0, le=1.0)


class TelemetryBatchIn(BaseModel):
    """Batch payload sent by the RPI5 position engine."""
    readings: list[RssiReading] = Field(default_factory=list, max_length=200)
    computed_positions: list[ComputedPosition] = Field(default_factory=list, max_length=100)


class TelemetryBatchAccepted(BaseModel):
    ok: bool = True
    registered_readings: int = 0
    unknown_macs: int = 0
    positions_upserted: int = 0
    proximity_events_fired: int = 0


# ---------------------------------------------------------------------------
# Gateway auth dependency (mirrors device_ingest_routes.py exactly)
# ---------------------------------------------------------------------------

async def require_gateway_auth(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    x_gateway_id: Annotated[str, Header(alias="X-Gateway-Id")],
    authorization: Annotated[str, Header()],
) -> AutomationGateway:
    """Validate X-Gateway-Id + Bearer <ingest_secret>. Returns the gateway row."""
    parts = authorization.split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        logger.warning(
            "telemetry_ingest invalid_auth_scheme ip=%s",
            request.client.host if request.client else "",
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_authorization")

    secret = parts[1].strip()
    gid = x_gateway_id.strip()

    svc = DeviceService(db)
    gw = await svc.get_gateway_by_id_only(gid)
    if gw is None or not gw.ingest_secret_hash:
        logger.warning(
            "telemetry_ingest unknown_gateway ip=%s gid_prefix=%s",
            request.client.host if request.client else "",
            gid[:8],
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_gateway_credentials")

    if not verify_password(secret, gw.ingest_secret_hash):
        logger.warning("telemetry_ingest bad_secret gateway_id=%s company_id=%s", gw.id, gw.company_id)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_gateway_credentials")

    return gw


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _norm_mac_safe(raw: str) -> Optional[str]:
    """Normalize MAC, return None if invalid (don't crash on malformed hardware output)."""
    try:
        return normalize_mac(raw)
    except ValueError:
        return None


async def _update_gateway_last_seen(db: AsyncSession, gateway_id: str) -> None:
    """Mark gateway online — keeps the Devices tab status indicator green."""
    await db.execute(
        text(
            "UPDATE automation_gateways SET last_seen_at = now(), status = 'online' "
            "WHERE id = :gid"
        ),
        {"gid": gateway_id},
    )


async def _resolve_macs(
    db: AsyncSession,
    company_id: str,
    macs: set[str],
) -> dict[str, AutomationBleDevice]:
    """Return {normalized_mac: AutomationBleDevice} for registered MACs only."""
    if not macs:
        return {}
    q = await db.execute(
        select(AutomationBleDevice).where(
            AutomationBleDevice.company_id == company_id,
            AutomationBleDevice.mac_address.in_(macs),
        )
    )
    return {d.mac_address: d for d in q.scalars().all()}


async def _log_unknown_macs(
    db: AsyncSession,
    company_id: str,
    unknown_macs: set[str],
    gateway_id: str,
) -> None:
    """
    Upsert into automation_unknown_devices so operators can discover and register
    unrecognised beacons from the Devices tab UI.

    Uses INSERT ... ON CONFLICT DO UPDATE so a single beacon seen 1000 times
    only ever has one row — just a rising seen_count and updated last_seen_at.
    """
    if not unknown_macs:
        return

    now = datetime.now(timezone.utc)
    for mac in unknown_macs:
        await db.execute(
            text("""
                INSERT INTO automation_unknown_devices
                    (id, company_id, mac_address, first_seen_at, last_seen_at, seen_count)
                VALUES
                    (:id, :company_id, :mac, :now, :now, 1)
                ON CONFLICT (company_id, mac_address)
                DO UPDATE SET
                    last_seen_at = EXCLUDED.last_seen_at,
                    seen_count   = automation_unknown_devices.seen_count + 1
            """),
            {"id": str(uuid4()), "company_id": company_id, "mac": mac, "now": now},
        )
    logger.debug(
        "telemetry_ingest logged %d unknown macs gateway=%s",
        len(unknown_macs),
        gateway_id[:8],
    )


async def _upsert_beacon_positions(
    db: AsyncSession,
    company_id: str,
    positions: list[ComputedPosition],
    mac_to_device: dict[str, AutomationBleDevice],
    gateway_zone_id: Optional[str],
) -> int:
    """
    Upsert beacon_positions (one row per beacon — always current position).

    Falls back to the gateway's zone_id for zone assignment if the position
    engine hasn't done a polygon lookup yet. The full Shapely polygon lookup
    can be added here once zone polygons are stored (migration B).

    Returns the number of rows upserted.
    """
    if not positions:
        return 0

    now = datetime.now(timezone.utc)
    count = 0

    for pos in positions:
        device = mac_to_device.get(pos.mac)
        if device is None:
            continue  # skip unregistered beacons

        # Simple zone assignment: use gateway zone until polygon lookup is wired up.
        # Once zone.polygon column exists (migration B), replace this with Shapely:
        #   zone_id = resolve_zone_from_polygon(pos.x_norm, pos.y_norm, zones)
        zone_id = gateway_zone_id

        await db.execute(
            text("""
                INSERT INTO beacon_positions
                    (beacon_id, company_id, x_norm, y_norm, zone_id, position_confidence, computed_at)
                VALUES
                    (:beacon_id, :company_id, :x, :y, :zone_id, :conf, :now)
                ON CONFLICT (beacon_id)
                DO UPDATE SET
                    x_norm               = EXCLUDED.x_norm,
                    y_norm               = EXCLUDED.y_norm,
                    zone_id              = EXCLUDED.zone_id,
                    position_confidence  = EXCLUDED.position_confidence,
                    computed_at          = EXCLUDED.computed_at
            """),
            {
                "beacon_id": device.id,
                "company_id": company_id,
                "x": pos.x_norm,
                "y": pos.y_norm,
                "zone_id": zone_id,
                "conf": pos.position_confidence,
                "now": now,
            },
        )
        count += 1

    return count


async def _fire_proximity_events(
    db: AsyncSession,
    company_id: str,
    gateway: AutomationGateway,
    readings: list[RssiReading],
    mac_to_device: dict[str, AutomationBleDevice],
) -> int:
    """
    For each (worker_tag, equipment_tag) pair seen in the same batch from this gateway,
    fire a proximity_update automation event.

    This slots directly into the existing proximity_logic.py → gateway_arbitration.py
    → maintenance_logic.py pipeline. No changes needed to those files.

    The event payload matches what event_enricher.py expects:
        gateway_id, worker_tag_mac, equipment_tag_mac, signal_strength, timestamp
    """
    # Separate workers from equipment in this batch
    worker_macs: list[tuple[str, int, float]] = []    # (mac, rssi, ts)
    equipment_macs: list[tuple[str, int, float]] = []

    for r in readings:
        device = mac_to_device.get(r.mac)
        if device is None:
            continue
        ts = r.ts if r.ts is not None else time.time()
        if device.type == "worker_tag":
            worker_macs.append((r.mac, r.rssi, ts))
        elif device.type == "equipment_tag":
            equipment_macs.append((r.mac, r.rssi, ts))

    if not worker_macs or not equipment_macs:
        return 0  # need at least one of each to fire a proximity event

    count = 0
    for w_mac, w_rssi, w_ts in worker_macs:
        for e_mac, e_rssi, e_ts in equipment_macs:
            # Average signal from both sides as a simple combined strength
            avg_rssi = (w_rssi + e_rssi) / 2
            ts = (w_ts + e_ts) / 2

            body = AutomationEventIn(
                event_type="proximity_update",
                gateway_id=str(gateway.id),
                worker_tag_mac=w_mac,
                equipment_tag_mac=e_mac,
                signal_strength=avg_rssi,
                timestamp=ts,
                zone_id=gateway.zone_id,
                source="telemetry_ingest",
            )
            await ingest_automation_event(db, company_id=company_id, body=body)
            count += 1

    return count


# ---------------------------------------------------------------------------
# Main endpoint
# ---------------------------------------------------------------------------

@router.post("/ingest", response_model=TelemetryBatchAccepted, status_code=status.HTTP_200_OK)
async def ingest_telemetry_batch(
    request: Request,
    body: TelemetryBatchIn,
    db: Annotated[AsyncSession, Depends(get_db)],
    gateway: Annotated[AutomationGateway, Depends(require_gateway_auth)],
) -> TelemetryBatchAccepted:
    """
    Receive a batch of RSSI readings (and optionally pre-computed positions) from the RPI5.

    Called by the RPI5 position engine every ~2 seconds per gateway.
    Auth: X-Gateway-Id: <gateway_uuid>  +  Authorization: Bearer <ingest_secret>
    """
    _ = request
    company_id = str(gateway.company_id)
    result = TelemetryBatchAccepted()

    if not body.readings and not body.computed_positions:
        # Empty batch — still update gateway heartbeat
        await _update_gateway_last_seen(db, gateway.id)
        await db.commit()
        return result

    # Best-effort mitigation for leaked gateway secret: cap readings/sec per gateway.
    await _enforce_gateway_rate_limit(
        gateway_id=str(gateway.id),
        readings=len(body.readings) + len(body.computed_positions),
    )

    # 1. Collect and normalize all MACs from this batch
    all_macs: set[str] = set()
    normalized_readings: list[RssiReading] = []

    for r in body.readings:
        mac = _norm_mac_safe(r.mac)
        if mac is None:
            logger.debug("telemetry_ingest skipping malformed mac raw=%r gateway=%s", r.mac, gateway.id[:8])
            continue
        all_macs.add(mac)
        normalized_readings.append(RssiReading(mac=mac, rssi=r.rssi, ts=r.ts))

    normalized_positions: list[ComputedPosition] = []
    for pos in body.computed_positions:
        mac = _norm_mac_safe(pos.mac)
        if mac is None:
            continue
        all_macs.add(mac)
        normalized_positions.append(ComputedPosition(
            mac=mac,
            x_norm=pos.x_norm,
            y_norm=pos.y_norm,
            position_confidence=pos.position_confidence,
        ))

    # 2. Resolve MACs → registered devices (single query)
    mac_to_device = await _resolve_macs(db, company_id, all_macs)
    registered_macs = set(mac_to_device.keys())
    unknown_macs = all_macs - registered_macs

    result.registered_readings = len([r for r in normalized_readings if r.mac in registered_macs])
    result.unknown_macs = len(unknown_macs)

    # 3. Update gateway heartbeat (keeps Devices tab status indicator live)
    await _update_gateway_last_seen(db, gateway.id)

    # 4. Log unknown MACs for the Devices tab "Discovered · Not Registered" UI
    await _log_unknown_macs(db, company_id, unknown_macs, gateway.id)

    # 5. Upsert beacon_positions for computed positions
    if normalized_positions:
        result.positions_upserted = await _upsert_beacon_positions(
            db,
            company_id,
            normalized_positions,
            mac_to_device,
            gateway.zone_id,
        )

    # 6. Fire proximity_update automation events for worker↔equipment pairs
    #    This feeds directly into proximity_logic.py → maintenance_logic.py
    if normalized_readings:
        result.proximity_events_fired = await _fire_proximity_events(
            db,
            company_id,
            gateway,
            normalized_readings,
            mac_to_device,
        )

    await db.commit()

    logger.info(
        "telemetry_ingest accepted gateway=%s company=%s registered=%d unknown=%d positions=%d proximity_events=%d",
        gateway.id[:8],
        company_id[:8],
        result.registered_readings,
        result.unknown_macs,
        result.positions_upserted,
        result.proximity_events_fired,
    )

    return result
