"""
What this file does (simple explanation):

This part of the system decides **what is going on** when a worker’s tag and a tool’s tag are
reported together—chiefly whether someone has **stayed near equipment long enough**, then **moved
away** in a way that should prompt a sign-out reminder (or similar action).

In plain terms:
Picture someone at a shared drill press: first we watch for “really there, holding still,” then
we watch for “walking off.” Crossing those lines in order is what triggers a polite nudge. Random
radio wobble should **not** spam the person.

Why this exists:
Business rules live here: how long “near” counts, how “far” clears the situation, and when to
start or end a “session” record. This is separate from picking **which gateway** heard the tags
(arbitration) and separate from turning addresses into people (enrichment).

How the system works (step-by-step):

1. Gateways hear Bluetooth tags and send proximity updates.
2. Enrichment attaches worker, equipment, and zone from your records.
3. Gateway arbitration ensures only the trusted gateway drives this logic for each pair.
4. **This file** tracks distance bands (near / medium / far), movement hints, and timing.
5. When rules fire, notifications or automation hooks can run and timeline events may be queued.

What saved state represents (same worker + same equipment key):

    last_distance / last_movement → last reported picture from the trusted gateway
    near_count, weak_near_count, far_count → simple counters to avoid reacting to one flaky sample
    first_seen_near → clock mark for “how long they have been genuinely near”
    active_session, session_started_* → whether we think a work session is open and for how long
    last_triggered_at → spacing so we do not nag repeatedly (cooldown)
    zone_id → room/area we think they are in; changing zone clears messy state on purpose
"""

from __future__ import annotations

import time
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.automation_engine import AutomationEvent
from app.models.domain import OperationalRole, Tool, User, Zone
from app.services.automation.actions import create_notification, emit_automation_triggered
from app.services.automation.config_service import FEATURE_PROXIMITY_TRACKING, get_config
from app.services.automation.logging_service import log_event
from app.services.automation.state_manager import load_state, save_state


def _payload_ts(payload: dict[str, Any]) -> float:
    """Prefer the event’s own timestamp; fall back to “now” if the gateway omitted it."""
    raw = payload.get("timestamp")
    if raw is None:
        return time.time()
    return float(raw)


def _entity_key(worker_id: str, equipment_id: str) -> str:
    """One label for this worker+tool pair in saved state (not the same key as gateway arbitration)."""
    return f"worker:{worker_id}|equipment:{equipment_id}"


async def _emit_session_started(
    db: AsyncSession,
    *,
    company_id: str,
    worker_id: str,
    equipment_id: str,
    zone_id: str,
    entity_key: str,
    source_automation_event_id: str,
    ts: float,
) -> None:
    """
    What this does:
        Schedules an internal “session started” automation event for timelines and reporting.

    When this runs:
        After we have decided a dwell+movement pattern qualified someone as starting a session.

    Why this matters:
        Downstream features can react without re-parsing raw radio history.
    """
    from app.services.automation.internal_event_pipeline import ingest_internal_event

    await ingest_internal_event(
        db,
        company_id=company_id,
        event_type="session_started",
        payload={
            "worker_id": worker_id,
            "equipment_id": equipment_id,
            "zone_id": zone_id,
            "entity_key": entity_key,
            "source_automation_event_id": source_automation_event_id,
            "timestamp": ts,
        },
    )


async def _emit_session_ended(
    db: AsyncSession,
    *,
    company_id: str,
    worker_id: str,
    equipment_id: str,
    zone_id: str,
    entity_key: str,
    source_automation_event_id: str,
    duration_seconds: float,
    reason: str,
    ts: float,
) -> None:
    """
    What this does:
        Schedules an internal “session ended” event with duration and a plain-English reason code.

    When this runs:
        When distance says “far,” a timeout fires, or the zone changes in a way that resets state.

    Why this matters:
        Gives supervisors a human-readable trail without guessing from raw pings.
    """
    from app.services.automation.internal_event_pipeline import ingest_internal_event

    await ingest_internal_event(
        db,
        company_id=company_id,
        event_type="session_ended",
        payload={
            "worker_id": worker_id,
            "equipment_id": equipment_id,
            "zone_id": zone_id,
            "entity_key": entity_key,
            "duration_seconds": round(float(duration_seconds), 3),
            "session_end_reason": reason,
            "source_automation_event_id": source_automation_event_id,
            "timestamp": ts,
        },
    )


async def handle(db: AsyncSession, event: AutomationEvent) -> None:
    """
    What this does:
        Main “worker near equipment” brain: updates or clears saved progress, may start/end sessions,
        and may queue a sign-out style notification when configured.

    When this runs:
        After enrichment and (for multi-gateway sites) only for messages from the winning gateway.

    Why this matters:
        This is where product behavior turns into actions people feel—without this, tags are just noise.
    """
    payload = dict(event.payload or {})
    if payload.get("rate_limited"):
        return

    company_id = str(payload.get("company_id") or "").strip()
    worker_id = payload.get("worker_id")
    equipment_id = payload.get("equipment_id")
    zone_id = payload.get("zone_id")

    if not company_id or not worker_id or not equipment_id:
        return

    worker_id = str(worker_id)
    equipment_id = str(equipment_id)
    entity_key = _entity_key(worker_id, equipment_id)

    if not zone_id or not str(zone_id).strip():
        await save_state(db, company_id, entity_key, {})
        return

    zone_id = str(zone_id).strip()
    u_ok = (
        await db.execute(
            select(User.id).where(
                User.id == worker_id,
                User.company_id == company_id,
                User.operational_role.in_([e.value for e in OperationalRole]),
            )
        )
    ).scalar_one_or_none()
    t_ok = (
        await db.execute(select(Tool.id).where(Tool.id == equipment_id, Tool.company_id == company_id))
    ).scalar_one_or_none()
    z_ok = (
        await db.execute(select(Zone.id).where(Zone.id == zone_id, Zone.company_id == company_id))
    ).scalar_one_or_none()
    if u_ok is None or t_ok is None or z_ok is None:
        await save_state(db, company_id, entity_key, {})
        return

    cfg = await get_config(db, company_id, FEATURE_PROXIMITY_TRACKING)
    if not cfg.get("enabled", True):
        return

    min_dur = float(cfg.get("min_duration_seconds", 10))
    cooldown_s = float(cfg.get("cooldown_seconds", 60))
    movement_required = bool(cfg.get("movement_required", True))
    send_prompt = bool(cfg.get("send_signout_prompt", True))
    min_near = max(1, int(cfg.get("min_consecutive_near", 2)))
    state_timeout_s = float(cfg.get("state_timeout_seconds", 30))
    max_session_s = float(cfg.get("max_session_seconds", 300))

    ts = _payload_ts(payload)
    distance = str(payload.get("distance", "")).lower()
    movement = str(payload.get("movement", "")).lower()
    now_wall = time.time()

    st = await load_state(db, company_id, entity_key)
    last_act = st.get("last_activity_at")
    if st and last_act is not None and (now_wall - float(last_act)) > state_timeout_s:
        st = {}

    if (
        st.get("active_session")
        and st.get("session_started_wall") is None
        and max_session_s > 0
        and st.get("session_started_at") is not None
    ):
        st["session_started_wall"] = now_wall

    prev_last_ts = st.get("last_event_ts")
    # Rule: ignore out-of-order timestamps so replay or clock quirks do not rewind state.
    if prev_last_ts is not None and ts < float(prev_last_ts):
        return

    # Rule: if the area label changed, clear memory—same pair in a new room is treated as fresh.
    stored_zone = st.get("zone_id")
    if stored_zone is not None and str(stored_zone) != zone_id:
        await log_event(
            db,
            company_id=company_id,
            log_type="zone_mismatch_reset",
            message="zone_id changed; proximity state cleared",
            payload={
                "entity_key": entity_key,
                "previous_zone_id": str(stored_zone),
                "incoming_zone_id": zone_id,
                "automation_event_id": event.id,
            },
            severity="warning",
            source_module="proximity",
        )
        await save_state(db, company_id, entity_key, {})
        return

    if (
        st.get("active_session")
        and st.get("session_started_wall") is not None
        and max_session_s > 0
        and (now_wall - float(st["session_started_wall"])) > max_session_s
    ):
        wall0 = float(st["session_started_wall"])
        dur_sess = max(0.0, now_wall - wall0)
        await log_event(
            db,
            company_id=company_id,
            log_type="session_max_exceeded",
            message="active_session cleared after max_session_seconds",
            payload={"entity_key": entity_key, "max_session_seconds": max_session_s},
            severity="info",
            source_module="proximity",
        )
        await _emit_session_ended(
            db,
            company_id=company_id,
            worker_id=worker_id,
            equipment_id=equipment_id,
            zone_id=zone_id,
            entity_key=entity_key,
            source_automation_event_id=event.id,
            duration_seconds=dur_sess,
            reason="session_timeout",
            ts=ts,
        )
        st["active_session"] = False
        st.pop("session_started_at", None)
        st.pop("session_started_wall", None)

    prev_movement = str(st.get("last_movement", "")).lower()

    # “Far” twice in a row = we believe they really left—ends sessions and clears counters.
    if distance == "far":
        far_count = int(st.get("far_count") or 0) + 1
        if far_count >= 2:
            if st.get("active_session") and st.get("session_started_wall") is not None:
                wall0 = float(st["session_started_wall"])
                dur_far = max(0.0, now_wall - wall0)
                await _emit_session_ended(
                    db,
                    company_id=company_id,
                    worker_id=worker_id,
                    equipment_id=equipment_id,
                    zone_id=zone_id,
                    entity_key=entity_key,
                    source_automation_event_id=event.id,
                    duration_seconds=dur_far,
                    reason="far_reset",
                    ts=ts,
                )
            elif st.get("active_session") and st.get("session_started_at") is not None:
                await _emit_session_ended(
                    db,
                    company_id=company_id,
                    worker_id=worker_id,
                    equipment_id=equipment_id,
                    zone_id=zone_id,
                    entity_key=entity_key,
                    source_automation_event_id=event.id,
                    duration_seconds=max(0.0, ts - float(st["session_started_at"])),
                    reason="far_reset",
                    ts=ts,
                )
            await save_state(db, company_id, entity_key, {})
            return
        st["far_count"] = far_count
        st["last_distance"] = distance
        st["last_movement"] = movement
        st["last_event_id"] = event.id
        st["last_activity_at"] = now_wall
        st["last_event_ts"] = ts
        st["zone_id"] = zone_id
        await save_state(db, company_id, entity_key, st)
        return

    st["far_count"] = 0

    # “Medium” is treated as weak proximity—we wait for clearer near/far, not prompts.
    if distance == "medium":
        st["weak_near_count"] = int(st.get("weak_near_count") or 0) + 1
        st.pop("first_seen_near", None)
        st["last_distance"] = distance
        st["last_movement"] = movement
        st["last_event_id"] = event.id
        st["last_activity_at"] = now_wall
        st["last_event_ts"] = ts
        st["zone_id"] = zone_id
        await save_state(db, company_id, entity_key, st)
        return

    # Any other distance label rolls into “not clearly near”—similar patience to medium.
    if distance != "near":
        st["weak_near_count"] = int(st.get("weak_near_count") or 0) + 1
        st.pop("first_seen_near", None)
        st["last_distance"] = distance
        st["last_movement"] = movement
        st["last_event_id"] = event.id
        st["last_activity_at"] = now_wall
        st["last_event_ts"] = ts
        st["zone_id"] = zone_id
        await save_state(db, company_id, entity_key, st)
        return

    st["near_count"] = int(st.get("near_count") or 0) + 1

    session_active = bool(st.get("active_session"))

    last_trig = st.get("last_triggered_at")
    in_cooldown = False
    if last_trig is not None and cooldown_s > 0:
        in_cooldown = (ts - float(last_trig)) < cooldown_s

    strong_ok = int(st.get("near_count") or 0) >= min_near
    weak_ok = int(st.get("weak_near_count") or 0) >= (min_near * 2)
    if movement == "stationary" and st.get("first_seen_near") is None:
        if strong_ok or weak_ok:
            st["first_seen_near"] = ts

    # Fire rule (plain language): only after someone was **stationary near** long enough,
    # then shows **movement**, and we are not in cooldown—then we treat it as “probably walking off.”
    fire = False
    if (
        not session_active
        and not in_cooldown
        and movement == "moving"
        and prev_movement == "stationary"
        and movement_required
        and send_prompt
    ):
        start = st.get("first_seen_near")
        if start is not None and ts - float(start) >= min_dur:
            fire = True

    st["last_distance"] = distance
    st["last_movement"] = movement

    near_count_snapshot = int(st.get("near_count") or 0)
    weak_snapshot = int(st.get("weak_near_count") or 0)
    duration_snapshot = (
        ts - float(st["first_seen_near"]) if st.get("first_seen_near") is not None else 0.0
    )

    if fire:
        await create_notification(
            db,
            user_id=worker_id,
            company_id=company_id,
            ntype="signout_prompt",
            payload={
                "equipment_id": equipment_id,
                "company_id": company_id,
                "event_id": event.id,
                "reason": "dwell + movement",
                "duration_seconds": duration_snapshot,
                "near_count": near_count_snapshot,
                "weak_near_count": weak_snapshot,
                "zone_id": zone_id,
            },
        )
        st["last_triggered_at"] = ts
        st["first_seen_near"] = None
        st["near_count"] = 0
        st["weak_near_count"] = 0
        st["active_session"] = True
        st["session_started_at"] = ts
        st["session_started_wall"] = now_wall

        await emit_automation_triggered(
            db,
            company_id=company_id,
            entity_id=worker_id,
            payload={
                "entity_key": entity_key,
                "worker_id": worker_id,
                "equipment_id": equipment_id,
                "automation_event_id": event.id,
                "feature": FEATURE_PROXIMITY_TRACKING,
                "reason": "dwell + movement",
                "duration_seconds": duration_snapshot,
                "near_count": near_count_snapshot,
                "weak_near_count": weak_snapshot,
            },
            correlation_id=event.id,
        )
        await log_event(
            db,
            company_id=company_id,
            log_type="automation_triggered",
            message="proximity dwell + movement",
            payload={
                "reason": "dwell + movement",
                "duration_seconds": duration_snapshot,
                "near_count": near_count_snapshot,
                "weak_near_count": weak_snapshot,
                "automation_event_id": event.id,
                "entity_key": entity_key,
                "worker_id": worker_id,
                "equipment_id": equipment_id,
            },
            severity="info",
            source_module="proximity",
        )
        await _emit_session_started(
            db,
            company_id=company_id,
            worker_id=worker_id,
            equipment_id=equipment_id,
            zone_id=zone_id,
            entity_key=entity_key,
            source_automation_event_id=event.id,
            ts=ts,
        )

    st["last_event_id"] = event.id
    st["last_activity_at"] = now_wall
    st["last_event_ts"] = ts
    st["zone_id"] = zone_id
    await save_state(db, company_id, entity_key, st)
