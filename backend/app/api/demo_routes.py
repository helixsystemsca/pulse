"""
Pulse · Demo Mode Backend
══════════════════════════════════════════════════════════════════════════════
A self-contained demo engine that simulates the full telemetry pipeline
without any physical hardware connected.

Demo scenario (Pool zone):
  - Daniel (worker) moves around the Pool zone
  - Drill (tool beacon) moves with Daniel — he's carrying it
  - Hot Tub Boiler (equipment) is stationary with an overdue PM
  - After ~60s, Daniel + Drill get close to the Boiler
  - Inference engine fires → ProximityPromptBanner appears on Expo app
  - Facility manager taps Confirm → work order auto-logs

How it works
-------------
  1. GET  /api/v1/demo/state        — current positions + inference state (polled by map)
  2. POST /api/v1/demo/start        — begin the scenario, reset state
  3. POST /api/v1/demo/reset        — reset to beginning
  4. POST /api/v1/demo/confirm      — simulate worker confirming the inference
  5. POST /api/v1/demo/dismiss      — simulate worker dismissing
  6. GET  /api/v1/demo/status       — is demo mode active for this company?
  7. POST /api/v1/demo/toggle       — enable/disable demo mode (admin only)

The demo state machine runs as an asyncio background task when started.
It fires real WebSocket events through the existing event_engine so the
dashboard's existing WS connection picks them up automatically.

Drop this file into: backend/app/api/demo_routes.py
Register in main.py: app.include_router(demo_router, prefix="/api/v1")
"""

from __future__ import annotations

import asyncio
import logging
import math
import time
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_company_admin
from app.core.events.engine import event_engine
from app.core.events.types import DomainEvent
from app.core.user_roles import user_has_any_role
from app.models.domain import User
from app.models.domain import UserRole

log = logging.getLogger("pulse.demo")
router = APIRouter(prefix="/demo", tags=["demo"])

# ══════════════════════════════════════════════════════════════════════════════
# DEMO ENTITIES
# Fixed UUIDs so the frontend can reference them without DB lookups.
# ══════════════════════════════════════════════════════════════════════════════

DEMO_COMPANY_ID   = "demo-company-00000000-0000-0000-0000-000000000001"

# Zone
POOL_ZONE_ID      = "demo-zone-pool-0000-0000-0000-000000000001"

# Gateways (ESP32s)
GW_NODE_1_ID      = "demo-gw-node1-000-0000-0000-000000000001"
GW_NODE_2_ID      = "demo-gw-node2-000-0000-0000-000000000001"
GW_GATEWAY_ID     = "demo-gw-main-0000-0000-0000-000000000001"

# Beacons
BEACON_DANIEL_ID     = "demo-beacon-daniel-000-0000-0000-000000000001"
BEACON_BOILER_ID     = "demo-beacon-boiler-000-0000-0000-000000000001"
BEACON_DRILL_ID      = "demo-beacon-drill-0000-0000-0000-000000000001"

# Inference
DEMO_INFERENCE_ID    = "demo-inference-00000-0000-0000-000000000001"
DEMO_WORK_ORDER_ID   = "demo-wo-000000000-0000-0000-000000000001"

# ══════════════════════════════════════════════════════════════════════════════
# SCENARIO SCRIPT
# A list of keyframes. The background task interpolates between them.
# Positions are normalised 0-1 on the Pool zone floor plan.
# ══════════════════════════════════════════════════════════════════════════════

# Pool zone layout (normalised):
#   +---------------------------+
#   |  Node 1 (0.15, 0.25)     |
#   |                           |
#   |   Hot Tub   Pool main     |
#   |   Boiler                  |
#   |   (0.25,    (0.65,        |
#   |    0.70)     0.45)        |
#   |                           |
#   |  Node 2 (0.85, 0.75)     |
#   +---------------------------+

BOILER_POS  = (0.25, 0.70)   # stationary
DANIEL_PATH = [
    # (t_seconds, x, y, description)
    (0,   0.80, 0.20, "Daniel enters pool zone — far from boiler"),
    (10,  0.65, 0.35, "Daniel checks main pool equipment"),
    (20,  0.55, 0.50, "Moving toward hot tub area"),
    (35,  0.40, 0.60, "Getting closer to boiler"),
    (50,  0.30, 0.68, "Daniel is near the hot tub boiler"),
    (65,  0.27, 0.71, "Daniel right next to boiler — inference fires"),
    (90,  0.27, 0.71, "Waiting for confirmation"),
    (110, 0.40, 0.55, "Daniel moves away after confirming"),
]

SCENARIO_DURATION_SEC = 120

# ══════════════════════════════════════════════════════════════════════════════
# DEMO STATE
# In-memory — resets on server restart, which is fine for demos.
# ══════════════════════════════════════════════════════════════════════════════

class DemoState:
    def __init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        self.active             = False
        self.started_at: Optional[float] = None
        self.elapsed_sec        = 0.0
        self.daniel_pos         = (0.80, 0.20)
        self.drill_pos          = (0.80, 0.20)   # Drill follows Daniel
        self.boiler_pos         = BOILER_POS
        self.inference_status   = "idle"          # idle | pending | confirmed | dismissed
        self.inference_fired_at: Optional[float] = None
        self.confidence         = 0.0
        self.scenario_complete  = False
        self._task: Optional[asyncio.Task] = None

    @property
    def proximity_m(self) -> float:
        """Euclidean distance between Daniel and Boiler, scaled to ~metres."""
        dx = (self.daniel_pos[0] - self.boiler_pos[0]) * 40   # 40m pool width
        dy = (self.daniel_pos[1] - self.boiler_pos[1]) * 25   # 25m pool length
        return math.sqrt(dx * dx + dy * dy)

    def to_dict(self) -> dict[str, Any]:
        return {
            "active":            self.active,
            "elapsed_sec":       round(self.elapsed_sec, 1),
            "scenario_duration": SCENARIO_DURATION_SEC,
            "scenario_complete": self.scenario_complete,
            "inference_status":  self.inference_status,
            "confidence":        round(self.confidence, 2),
            "proximity_m":       round(self.proximity_m, 1),
            "beacons": [
                {
                    "id":        BEACON_DANIEL_ID,
                    "label":     "Daniel",
                    "type":      "worker",
                    "x_norm":    round(self.daniel_pos[0], 4),
                    "y_norm":    round(self.daniel_pos[1], 4),
                    "zone_id":   POOL_ZONE_ID,
                    "status":    "online",
                },
                {
                    "id":        BEACON_DRILL_ID,
                    "label":     "Drill",
                    "type":      "tool",
                    "x_norm":    round(self.drill_pos[0], 4),
                    "y_norm":    round(self.drill_pos[1], 4),
                    "zone_id":   POOL_ZONE_ID,
                    "status":    "online",
                },
                {
                    "id":        BEACON_BOILER_ID,
                    "label":     "Hot Tub Boiler",
                    "type":      "equipment",
                    "x_norm":    round(self.boiler_pos[0], 4),
                    "y_norm":    round(self.boiler_pos[1], 4),
                    "zone_id":   POOL_ZONE_ID,
                    "status":    "pm_overdue",
                },
            ],
            "gateways": [
                {"id": GW_NODE_1_ID,  "label": "Node 1",   "x_norm": 0.15, "y_norm": 0.25, "online": True},
                {"id": GW_NODE_2_ID,  "label": "Node 2",   "x_norm": 0.85, "y_norm": 0.75, "online": True},
                {"id": GW_GATEWAY_ID, "label": "Gateway",  "x_norm": 0.50, "y_norm": 0.10, "online": True},
            ],
            "zone": {
                "id":    POOL_ZONE_ID,
                "name":  "Pool",
                "type":  "aquatics",
            },
            "inference": {
                "id":            DEMO_INFERENCE_ID,
                "worker_name":   "Daniel",
                "asset_name":    "Hot Tub Boiler",
                "work_order_id": DEMO_WORK_ORDER_ID,
                "pm_name":       "Monthly boiler inspection & water chemistry check",
                "pm_overdue_days": 3,
                "confidence":    round(self.confidence, 2),
                "status":        self.inference_status,
                "fired_at":      self.inference_fired_at,
            } if self.inference_status != "idle" else None,
        }


_demo_state = DemoState()


def _require_demo_tenant_or_system_admin(user: User) -> None:
    """
    Demo state is a global singleton. Until we make it per-company, restrict
    destructive demo actions to the demo tenant (or system admins).
    """
    if user.is_system_admin or user_has_any_role(user, UserRole.system_admin):
        return
    if str(user.company_id) != str(DEMO_COMPANY_ID):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="demo_admin_only")


# ══════════════════════════════════════════════════════════════════════════════
# INTERPOLATION HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def _lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * max(0.0, min(1.0, t))


def _interpolate_daniel_pos(elapsed: float) -> tuple[float, float]:
    """Smooth linear interpolation between keyframe positions."""
    path = DANIEL_PATH
    if elapsed <= path[0][0]:
        return (path[0][1], path[0][2])
    if elapsed >= path[-1][0]:
        return (path[-1][1], path[-1][2])

    for i in range(len(path) - 1):
        t0, x0, y0, _ = path[i]
        t1, x1, y1, _ = path[i + 1]
        if t0 <= elapsed <= t1:
            progress = (elapsed - t0) / (t1 - t0)
            # Ease in-out for natural movement
            progress = progress * progress * (3 - 2 * progress)
            return (_lerp(x0, x1, progress), _lerp(y0, y1, progress))

    return (path[-1][1], path[-1][2])


def _compute_confidence(elapsed: float, proximity_m: float) -> float:
    """
    Score rises as Daniel gets closer and dwell time increases.
    Mirrors the real maintenance_logic.py scoring logic.
    """
    # Proximity score
    if proximity_m < 1.5:   prox = 1.00
    elif proximity_m < 3.0: prox = 0.75
    elif proximity_m < 5.0: prox = 0.50
    else:                    prox = 0.10

    # Dwell time score (Daniel starts getting close around t=35)
    dwell = max(0.0, elapsed - 35.0)
    if dwell > 30:   dwell_score = 1.00
    elif dwell > 15: dwell_score = 0.75
    elif dwell > 5:  dwell_score = 0.40
    else:            dwell_score = 0.10

    # PM overdue + role match + tool present (all true in this scenario)
    context = 0.20 + 0.15 + 0.10   # open_pm + role_match + tool_beacon

    return min(1.0, prox * 0.30 + dwell_score * 0.20 + context)


# ══════════════════════════════════════════════════════════════════════════════
# BACKGROUND TASK — runs the scenario tick by tick
# ══════════════════════════════════════════════════════════════════════════════

async def _run_scenario(company_id: str) -> None:
    """Advances demo state every second, fires WS events at key moments."""
    state = _demo_state
    state.started_at = time.time()
    inference_notified = False

    try:
        while state.active and state.elapsed_sec < SCENARIO_DURATION_SEC:
            await asyncio.sleep(1.0)
            if not state.active:
                break

            state.elapsed_sec = time.time() - state.started_at

            # Move Daniel (Drill follows with tiny natural lag)
            state.daniel_pos = _interpolate_daniel_pos(state.elapsed_sec)
            state.drill_pos  = (
                state.daniel_pos[0] + 0.015,   # slightly offset from Daniel
                state.daniel_pos[1] + 0.010,
            )

            # Update confidence
            if state.inference_status in ("idle", "pending"):
                state.confidence = _compute_confidence(
                    state.elapsed_sec, state.proximity_m
                )

            # Fire inference when confidence crosses 90% for the first time
            if (
                state.confidence >= 0.90
                and state.inference_status == "idle"
                and not inference_notified
            ):
                state.inference_status  = "pending"
                state.inference_fired_at = time.time()
                inference_notified = True
                log.info("Demo inference fired at t=%.0fs conf=%.2f", state.elapsed_sec, state.confidence)

                # Broadcast through existing WS event engine
                await event_engine.publish(DomainEvent(
                    company_id=company_id,
                    event_type="demo_inference_fired",
                    entity_id=DEMO_INFERENCE_ID,
                    source_module="demo",
                    occurred_at=datetime.now(timezone.utc),
                    metadata={
                        "inference_id":    DEMO_INFERENCE_ID,
                        "worker_name":     "Daniel",
                        "asset_name":      "Hot Tub Boiler",
                        "confidence":      round(state.confidence, 2),
                        "pm_name":         "Monthly boiler inspection & water chemistry check",
                        "pm_overdue_days": 3,
                        "work_order_id":   DEMO_WORK_ORDER_ID,
                        "expires_in_sec":  120,
                    },
                ))

            # Broadcast position update every tick
            await event_engine.publish(DomainEvent(
                company_id=company_id,
                event_type="demo_position_update",
                entity_id=DEMO_COMPANY_ID,
                source_module="demo",
                occurred_at=datetime.now(timezone.utc),
                metadata=state.to_dict(),
            ))

        state.scenario_complete = True
        log.info("Demo scenario complete")

    except asyncio.CancelledError:
        log.info("Demo scenario cancelled")
    except Exception as e:
        log.error("Demo scenario error: %s", e)


# ══════════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class DemoToggleBody(BaseModel):
    enabled: bool


# ══════════════════════════════════════════════════════════════════════════════
# ROUTES
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/state")
async def get_demo_state() -> dict:
    """Current demo state — polled every second by the live map component."""
    return _demo_state.to_dict()


@router.post("/start")
async def start_demo(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_company_admin),
) -> dict:
    """Start or restart the demo scenario."""
    _require_demo_tenant_or_system_admin(user)
    state = _demo_state

    # Cancel any running scenario
    if state._task and not state._task.done():
        state._task.cancel()
        await asyncio.sleep(0.1)

    state.reset()
    state.active = True
    state._task  = asyncio.create_task(
        _run_scenario(str(user.company_id))
    )

    log.info("Demo started by user=%s company=%s", user.id[:8], str(user.company_id)[:8])
    return {"ok": True, "message": "Demo scenario started"}


@router.post("/reset")
async def reset_demo(
    user: User = Depends(require_company_admin),
) -> dict:
    """Reset to the beginning without starting."""
    _require_demo_tenant_or_system_admin(user)
    state = _demo_state
    if state._task and not state._task.done():
        state._task.cancel()
    state.reset()
    return {"ok": True, "message": "Demo reset"}


@router.post("/confirm")
async def confirm_inference(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_company_admin),
) -> dict:
    """
    Simulate the worker tapping 'Confirm' on the ProximityPromptBanner.
    Updates demo state and fires a WS event so the dashboard reacts.
    """
    _require_demo_tenant_or_system_admin(user)
    state = _demo_state
    if state.inference_status != "pending":
        raise HTTPException(status_code=400, detail="no_pending_inference")

    state.inference_status = "confirmed"

    await event_engine.publish(DomainEvent(
        company_id=str(user.company_id),
        event_type="demo_inference_confirmed",
        entity_id=DEMO_INFERENCE_ID,
        source_module="demo",
        occurred_at=datetime.now(timezone.utc),
        metadata={
            "inference_id":  DEMO_INFERENCE_ID,
            "confirmed_by":  "Daniel",
            "work_order_id": DEMO_WORK_ORDER_ID,
            "auto_logged":   True,
            "message":       "Work order #WO-441 updated — PM in progress logged automatically.",
        },
    ))

    log.info("Demo inference confirmed")
    return {
        "ok": True,
        "message": "Confirmed — work order auto-logged",
        "work_order_id": DEMO_WORK_ORDER_ID,
    }


@router.post("/dismiss")
async def dismiss_inference(
    user: User = Depends(require_company_admin),
) -> dict:
    """Simulate the worker tapping 'Not right now'."""
    _require_demo_tenant_or_system_admin(user)
    state = _demo_state
    if state.inference_status != "pending":
        raise HTTPException(status_code=400, detail="no_pending_inference")

    state.inference_status = "dismissed"

    await event_engine.publish(DomainEvent(
        company_id=str(user.company_id),
        event_type="demo_inference_dismissed",
        entity_id=DEMO_INFERENCE_ID,
        source_module="demo",
        occurred_at=datetime.now(timezone.utc),
        metadata={"inference_id": DEMO_INFERENCE_ID},
    ))

    return {"ok": True, "message": "Dismissed"}


@router.get("/status")
async def demo_status() -> dict:
    """Is demo mode currently running?"""
    return {
        "active":   _demo_state.active,
        "elapsed":  round(_demo_state.elapsed_sec, 1),
        "complete": _demo_state.scenario_complete,
    }
