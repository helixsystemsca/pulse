"""
What this file does (simple explanation):

This part of the system is responsible for choosing **which gateway (which sensor box)** we trust
when more than one gateway reports the **same worker near the same piece of equipment**.

In plain terms:
Imagine two doorways, each with a small radio listener. Both might “see” the same worker’s badge
and the same tool tag. This file acts like a calm referee: it picks **one** listener to follow,
so the rest of the system does not get confused by conflicting reports.

Why this exists:
In real buildings, Bluetooth signals bounce and overlap. Without this step, distance and movement
could flip back and forth between gateways. That would make prompts, sessions, and history
unreliable. We lock onto the best **current** source using signal strength, how often we hear the
tag, simple timing rules, and (when helpful) which **area (zone)** the report came from.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Any, Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.automation_engine import AutomationEvent
from app.services.automation.logging_service import log_event
from app.services.automation.state_manager import load_state, save_state
from app.services.devices.device_service import normalize_mac

logger = logging.getLogger(__name__)

# Stored records use a prefix so we do not mix this data with other saved state for the same pair.
GW_ARB_PREFIX = "gw_arb:"

# How long since we last trusted the active gateway before we say it is “stale” and may switch.
_STALE_SECONDS = 3.0
# Only change winner if the newcomer is clearly better (after a small fairness discount below).
_SWITCH_MARGIN = 0.2
# After we switch, wait this long before allowing another switch (stops rapid flip-flop).
_COOLDOWN_SECONDS = 2.0
# Wait this long after first hearing a pair before picking any gateway (avoids grabbing the first blip).
_FIRST_SELECTION_DWELL_SEC = 0.3
# Ignore very weak radio readings; they behave like static on a phone call.
_RSSI_FLOOR_DB = -95.0
# Slightly “fade” the old winner’s score so a fair newcomer can take over without needing perfection.
_SCORE_DECAY_FACTOR = 0.95
# Tiny extra credit if the report comes from the same area we last trusted (building layout).
_ZONE_BONUS = 0.1

Action = Literal[
    "selected_first",
    "process_active",
    "switched",
    "reject_cooldown",
    "reject_not_active",
    "reject_first_dwell",
    "reject_weak_rssi",
    "bypass",
]


@dataclass(frozen=True)
class ArbitrationResult:
    """
    One verdict from the gateway referee for a single proximity message.

    should_process → “yes, let the worker-near-tool brain run on this message”
    action → short machine label for logs (selected / rejected / switched / etc.)
    score → blended 0–1 style strength we used for the decision
    """

    should_process: bool
    action: Action
    active_gateway_id: str | None
    score: float
    previous_gateway_id: str | None = None


def _clamp01(x: float) -> float:
    if x < 0.0:
        return 0.0
    if x > 1.0:
        return 1.0
    return x


def canonical_entity_key(payload: dict[str, Any]) -> str | None:
    """
    What this does:
        Builds one stable label for “this worker + this equipment” (or the two tag radios) so all
        gateways talking about the **same pair** share one saved decision.

    When this runs:
        While handling each proximity message, before reading or writing arbitration state.

    Why this matters:
        Without a single label, we could not remember which gateway we trust for that situation.
    """
    wid = payload.get("worker_id")
    eid = payload.get("equipment_id")
    if wid is not None and str(wid).strip() and eid is not None and str(eid).strip():
        return f"worker:{str(wid).strip()}|equipment:{str(eid).strip()}"
    wm = str(payload.get("worker_tag_mac") or "").strip()
    em = str(payload.get("equipment_tag_mac") or "").strip()
    if not wm or not em:
        return None
    try:
        nw = normalize_mac(wm)
        ne = normalize_mac(em)
    except ValueError:
        return None
    return f"mac:w:{nw}|e:{ne}"


def state_key_for_pair(canonical_key: str) -> str:
    """Turns the human-readable pair label into the database key used only for gateway picking."""
    return f"{GW_ARB_PREFIX}{canonical_key}"


def _rssi_dbm(rssi: Any) -> float | None:
    try:
        return float(rssi)
    except (TypeError, ValueError):
        return None


def rssi_below_floor(rssi: Any) -> bool:
    """
    What this does:
        Says “this radio reading is too faint to trust” (missing counts as too faint).

    When this runs:
        Early in arbitration, before we score or save anything.

    Why this matters:
        Very weak signals behave randomly; acting on them causes false near/far flips.
    """
    r = _rssi_dbm(rssi)
    if r is None:
        return True
    return r < _RSSI_FLOOR_DB


def compute_score(
    *,
    rssi: Any,
    tag_seen_count_1s: Any,
    gateway_id: str,
    active_gateway_id: str | None,
) -> float:
    """
    What this does:
        Mixes “how loud the radio is,” “how often we heard the tag lately,” and a small nudge for
        the gateway we already trust into one number between 0 and 1.

    When this runs:
        For every proximity message that passed basic checks.

    Why this matters:
        The referee needs a simple, fair way to compare two gateways on the same pair.
    """
    try:
        r = float(rssi)
    except (TypeError, ValueError):
        r = -100.0
    try:
        seen = int(tag_seen_count_1s)
    except (TypeError, ValueError):
        seen = 0
    n_rssi = _clamp01((r + 100.0) / 40.0)
    n_seen = _clamp01(seen / 10.0)
    sticky = 1.0 if active_gateway_id and gateway_id == active_gateway_id else 0.0
    return 0.6 * n_rssi + 0.3 * n_seen + 0.1 * sticky


def apply_zone_bonus(base_score: float, *, event_zone_id: Any, last_zone_id: Any) -> float:
    """
    What this does:
        If the incoming report’s **area** matches the area we last accepted, add a small bonus.

    When this runs:
        Right after the base score is computed.

    Why this matters:
        When two listeners overlap, favoring continuity by location reduces pointless handoffs.
    """
    ez = str(event_zone_id or "").strip()
    lz = str(last_zone_id or "").strip()
    if ez and lz and ez == lz:
        return _clamp01(base_score + _ZONE_BONUS)
    return _clamp01(base_score)


def _decide(
    *,
    now: float,
    gateway_id: str,
    new_score: float,
    st: dict[str, Any],
) -> tuple[dict[str, Any], Action, str | None]:
    """
    What this does:
        Applies the referee rules: pick a first winner, refresh the winner, or refuse a weak
        challenger—or replace a stale winner.

    When this runs:
        After scoring an event, using the saved snapshot for this worker+equipment pair.

    Why this matters:
        This is the core “do we change who we trust?” logic in one place.

    What this data represents (saved `st` fields used here):
        active_gateway_id → which gateway we currently trust for this pair
        last_score → how strong our last trust decision looked (0–1 style blend)
        cooldown_until → clock time after which we may switch to someone else again
        last_update → last time the **trusted** gateway refreshed our trust
    """
    active = str(st.get("active_gateway_id") or "").strip()
    cooldown_until = float(st.get("cooldown_until") or 0.0)
    last_score = float(st.get("last_score") or 0.0)
    last_update = float(st.get("last_update") or 0.0)
    # Rule: gently discount the old winner so newcomers do not need a perfect edge.
    decayed_score = last_score * _SCORE_DECAY_FACTOR

    if not active:
        nxt = {
            **st,
            "active_gateway_id": gateway_id,
            "last_score": new_score,
            "cooldown_until": 0.0,
            "last_update": now,
        }
        return nxt, "selected_first", None

    if gateway_id == active:
        nxt = {**st, "last_score": new_score, "last_update": now}
        return nxt, "process_active", None

    # Rule: right after a switch, ignore other gateways for a short cooling-off period.
    if now < cooldown_until:
        return dict(st), "reject_cooldown", None

    # Rule: if we have heard nothing useful from the trusted gateway for a few seconds, allow
    # someone else—even if their score is not dramatically higher (dead handoff).
    stale = (now - last_update) > _STALE_SECONDS
    # Rule: switch only if the challenger is clearly better than the **discounted** old score,
    # unless the trusted source is stale (handled above).
    if new_score > decayed_score + _SWITCH_MARGIN or stale:
        prev = active
        nxt = {
            **st,
            "active_gateway_id": gateway_id,
            "last_score": new_score,
            "last_update": now,
            "cooldown_until": now + _COOLDOWN_SECONDS,
        }
        return nxt, "switched", prev

    return dict(st), "reject_not_active", None


async def evaluate(db: AsyncSession, event: AutomationEvent) -> ArbitrationResult:
    """
    What this does:
        For one saved “proximity update” event, updates the referee’s memory and answers
        **yes or no**: should we run the “worker near equipment” brain for this message?

    When this runs:
        Right before proximity logic, only for proximity-style events.

    Why this matters:
        If we skipped this, multiple gateways could fight each other inside the same decision logic.

    How this fits the bigger story (high level):
        1) A gateway radio hears tags and sends a message to the server.
        2) Enrichment turns raw tag addresses into real worker + equipment records.
        3) **This file** picks which gateway to listen to for that pair.
        4) Proximity logic decides what is happening (near/far, movement, sessions).
        5) Other automation may send a notification or record a timeline step.
    """
    payload = dict(event.payload or {})
    company_id = str(payload.get("company_id") or "").strip()
    ce = canonical_entity_key(payload)
    gateway_id = str(payload.get("gateway_id") or "").strip()

    if payload.get("rate_limited"):
        return ArbitrationResult(
            should_process=True,
            action="bypass",
            active_gateway_id=None,
            score=0.0,
        )

    if not ce or not company_id or not gateway_id:
        return ArbitrationResult(
            should_process=True,
            action="bypass",
            active_gateway_id=None,
            score=0.0,
        )

    if rssi_below_floor(payload.get("rssi")):
        await log_event(
            db,
            company_id=company_id,
            log_type="gateway_rejected",
            message="proximity event rejected by gateway arbitration (RSSI below floor)",
            payload={
                "gateway_id": gateway_id,
                "rssi": payload.get("rssi"),
                "entity_key": ce,
                "reason": "reject_weak_rssi",
                "automation_event_id": event.id,
            },
            severity="info",
            source_module="gateway_arbitration",
        )
        logger.info(
            "gateway_rejected weak_rssi gateway_id=%s rssi=%s entity=%s",
            gateway_id,
            payload.get("rssi"),
            ce,
        )
        return ArbitrationResult(
            should_process=False,
            action="reject_weak_rssi",
            active_gateway_id=None,
            score=0.0,
        )

    sk = state_key_for_pair(ce)
    st = await load_state(db, company_id, sk)
    now = time.time()
    active_for_dwell = str(st.get("active_gateway_id") or "").strip()

    # first_seen_at → when we first started hearing this pair (used only before any gateway wins).
    # Rule: wait briefly so we do not lock onto the first random gateway that spoke first.
    if not active_for_dwell:
        fs = float(st.get("first_seen_at") or 0.0)
        if fs <= 0.0:
            st = {**st, "first_seen_at": now}
            await save_state(db, company_id, sk, st)
            await log_event(
                db,
                company_id=company_id,
                log_type="gateway_rejected",
                message="gateway arbitration: first-selection dwell pending",
                payload={
                    "gateway_id": gateway_id,
                    "entity_key": ce,
                    "reason": "reject_first_dwell",
                    "dwell_seconds": _FIRST_SELECTION_DWELL_SEC,
                    "automation_event_id": event.id,
                },
                severity="info",
                source_module="gateway_arbitration",
            )
            logger.info(
                "gateway_rejected first_dwell_start gateway_id=%s entity=%s",
                gateway_id,
                ce,
            )
            return ArbitrationResult(
                should_process=False,
                action="reject_first_dwell",
                active_gateway_id=None,
                score=0.0,
            )
        if (now - fs) < _FIRST_SELECTION_DWELL_SEC:
            logger.debug(
                "gateway_rejected first_dwell_wait gateway_id=%s entity=%s elapsed=%.3fs",
                gateway_id,
                ce,
                now - fs,
            )
            return ArbitrationResult(
                should_process=False,
                action="reject_first_dwell",
                active_gateway_id=None,
                score=0.0,
            )

    active_for_score = active_for_dwell or None
    base = compute_score(
        rssi=payload.get("rssi"),
        tag_seen_count_1s=payload.get("tag_seen_count_1s"),
        gateway_id=gateway_id,
        active_gateway_id=active_for_score,
    )
    score = apply_zone_bonus(base, event_zone_id=payload.get("zone_id"), last_zone_id=st.get("last_zone_id"))

    new_st, action, prev_gw = _decide(now=now, gateway_id=gateway_id, new_score=score, st=st)

    if action in ("reject_cooldown", "reject_not_active"):
        await log_event(
            db,
            company_id=company_id,
            log_type="gateway_rejected",
            message="proximity event rejected by gateway arbitration",
            payload={
                "gateway_id": gateway_id,
                "score": round(score, 4),
                "previous_gateway": st.get("active_gateway_id"),
                "entity_key": ce,
                "reason": action,
                "automation_event_id": event.id,
            },
            severity="info",
            source_module="gateway_arbitration",
        )
        logger.info(
            "gateway_rejected gateway_id=%s score=%.4f previous_gateway=%s reason=%s entity=%s",
            gateway_id,
            score,
            st.get("active_gateway_id"),
            action,
            ce,
        )
        return ArbitrationResult(
            should_process=False,
            action=action,
            active_gateway_id=str(st.get("active_gateway_id") or "") or None,
            score=score,
            previous_gateway_id=None,
        )

    # last_zone_id → remember the area tag for gentle “same room” scoring on future messages.
    zid = str(payload.get("zone_id") or "").strip()
    if zid:
        new_st["last_zone_id"] = zid

    await save_state(db, company_id, sk, new_st)
    active_after = str(new_st.get("active_gateway_id") or "").strip()

    if action == "selected_first":
        await log_event(
            db,
            company_id=company_id,
            log_type="gateway_selected",
            message="initial gateway selected for worker/equipment pair",
            payload={
                "gateway_id": gateway_id,
                "score": round(score, 4),
                "previous_gateway": None,
                "entity_key": ce,
                "automation_event_id": event.id,
            },
            severity="info",
            source_module="gateway_arbitration",
        )
        logger.info(
            "gateway_selected gateway_id=%s score=%.4f entity=%s",
            gateway_id,
            score,
            ce,
        )
    elif action == "switched":
        await log_event(
            db,
            company_id=company_id,
            log_type="gateway_switched",
            message="active gateway switched for worker/equipment pair",
            payload={
                "gateway_id": gateway_id,
                "score": round(score, 4),
                "previous_gateway": prev_gw,
                "entity_key": ce,
                "automation_event_id": event.id,
            },
            severity="info",
            source_module="gateway_arbitration",
        )
        logger.info(
            "gateway_switched gateway_id=%s score=%.4f previous_gateway=%s entity=%s",
            gateway_id,
            score,
            prev_gw,
            ce,
        )
    elif action == "process_active":
        logger.debug(
            "gateway_active_refresh gateway_id=%s score=%.4f entity=%s",
            gateway_id,
            score,
            ce,
        )

    return ArbitrationResult(
        should_process=(gateway_id == active_after),
        action=action,
        active_gateway_id=active_after or None,
        score=score,
        previous_gateway_id=prev_gw,
    )
