"""
PM Inference Engine — maintenance automation hooks.

What this file does (plain English)
-------------------------------------
When a worker's BLE tag and a piece of equipment's BLE tag are seen close together for
long enough, proximity_logic.py fires a "maintenance_signal" event. This file catches that
signal and asks: "Is there a good reason this worker is standing next to this equipment?"

If there is an open or overdue PM task for that equipment, and the worker's role is
appropriate, we score a confidence level and either:
  - Send the worker a push notification asking them to confirm they're doing maintenance (≥ 90%)
  - Create an AutomationNotification for manager review (70–89%)
  - Log silently and do nothing else (< 70%)

When a worker confirms, the work request status is updated automatically and a PM log entry
is created — zero manual data entry.

How the confidence score works
-------------------------------
We add up weighted signals. You can tune the weights in SIGNAL_WEIGHTS below.
The score is capped at 1.0 (100%).

    Proximity duration   max 0.30   (how long they've been near)
    PM task overdue      max 0.20   (overdue tasks boost confidence)
    Open PM task exists  0.20       (flat bonus — there's work to do here)
    Role match           0.15       (worker's operational role suits this equipment type)
    Same zone as equip   0.10       (belt-and-suspenders zone check)
    On active shift      0.05       (they're supposed to be working)

How this connects to the rest of the system
---------------------------------------------
Event flow:
    telemetry_ingest_routes.py
      → ingest_automation_event (proximity_update)
        → event_enricher.py (resolves MACs → worker_id, equipment_id)
          → gateway_arbitration.py (picks trusted gateway)
            → proximity_logic.py (dwell timer, near/far, session tracking)
              → ingest_internal_event("maintenance_signal")  ← triggers THIS file
                → create_notification (push to worker)
                  → ProximityPromptBanner (Expo app)

What "maintenance_signal" payload contains (set by proximity_logic.py)
  worker_id         str   — User.id of the worker
  equipment_id      str   — Tool.id (the BLE-tracked equipment)
  zone_id           str   — Zone.id where this happened
  company_id        str   — tenant scope
  duration_seconds  float — how long worker was near (from proximity_logic dwell timer)
  signal_strength   float — average RSSI of the session
  source_event_id   str   — AutomationEvent.id that triggered this
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.automation_engine import AutomationEvent, AutomationNotification
from app.models.domain import FacilityEquipment, Tool, User, Zone
from app.models.pm_models import PmTask
from app.models.pulse_models import PulseWorkRequest, PulseWorkRequestPriority, PulseWorkRequestStatus
from app.services.automation.actions import create_notification, emit_automation_triggered
from app.services.automation.config_service import get_config
from app.services.automation.logging_service import log_event

logger = logging.getLogger(__name__)

# ── Feature flag key (matches your existing pattern in config_service.py) ────
FEATURE_MAINTENANCE_INFERENCE = "maintenance_inference"

# ── Confidence thresholds ─────────────────────────────────────────────────────
THRESHOLD_NOTIFY = 0.90    # send push notification to worker
THRESHOLD_FLAG   = 0.70    # create manager-review notification, no worker push
# below THRESHOLD_FLAG → silent log only

# ── Signal weights (must sum ≤ 1.0) ──────────────────────────────────────────
# Tune these once you have real confirmed/dismissed data from the field.
SIGNAL_WEIGHTS = {
    "proximity_duration": 0.30,   # dwell time near equipment
    "pm_overdue":         0.20,   # task is past next_due_at
    "open_pm_exists":     0.20,   # there IS an open PM for this equipment
    "role_match":         0.15,   # worker role is appropriate for this equipment
    "same_zone":          0.10,   # worker and equipment are in the same zone
    "on_shift":           0.05,   # worker has an active scheduled shift right now
}

# ── Role → equipment type mapping ─────────────────────────────────────────────
# Add your facility's operational roles and equipment types here.
# Keys are User.operational_role values; values are equipment type substrings (case-insensitive).
ROLE_EQUIPMENT_AFFINITY: dict[str, list[str]] = {
    "maintenance_manager": [],           # managers match everything
    "ice_tech":            ["ice", "zamboni", "compressor", "refriger"],
    "pool_tech":           ["pool", "pump", "filter", "chlorin", "chemical"],
    "hvac_tech":           ["hvac", "air", "heat", "ventil", "cooling", "boiler"],
    "electrician":         ["electric", "panel", "generator", "ups"],
    "general_maintenance": [],           # general workers match everything
    "custodial":           ["floor", "clean", "wash", "drain"],
}


# ── Internal data structures ──────────────────────────────────────────────────

@dataclass
class _InferenceContext:
    """Everything we need to score a maintenance inference. Loaded once per event."""
    company_id: str
    worker_id: str
    equipment_id: str            # Tool.id (BLE-tracked)
    zone_id: str
    duration_seconds: float
    source_event_id: str

    worker: Optional[User] = None
    tool: Optional[Tool] = None
    facility_equipment: Optional[FacilityEquipment] = None
    open_pm_tasks: list[PmTask] = field(default_factory=list)
    most_urgent_pm: Optional[PmTask] = None
    on_shift: bool = False


@dataclass
class _SignalScores:
    proximity_duration: float = 0.0
    pm_overdue: float = 0.0
    open_pm_exists: float = 0.0
    role_match: float = 0.0
    same_zone: float = 0.0
    on_shift: float = 0.0

    def total(self) -> float:
        return min(1.0, sum([
            self.proximity_duration * SIGNAL_WEIGHTS["proximity_duration"],
            self.pm_overdue         * SIGNAL_WEIGHTS["pm_overdue"],
            self.open_pm_exists     * SIGNAL_WEIGHTS["open_pm_exists"],
            self.role_match         * SIGNAL_WEIGHTS["role_match"],
            self.same_zone          * SIGNAL_WEIGHTS["same_zone"],
            self.on_shift           * SIGNAL_WEIGHTS["on_shift"],
        ]))

    def as_dict(self) -> dict[str, float]:
        return {
            "proximity_duration": round(self.proximity_duration, 3),
            "pm_overdue":         round(self.pm_overdue, 3),
            "open_pm_exists":     round(self.open_pm_exists, 3),
            "role_match":         round(self.role_match, 3),
            "same_zone":          round(self.same_zone, 3),
            "on_shift":           round(self.on_shift, 3),
            "total":              round(self.total(), 3),
        }


# ── Data loading ─────────────────────────────────────────────────────────────

async def _load_context(db: AsyncSession, ctx: _InferenceContext) -> bool:
    """
    Load worker, tool, facility_equipment, and open PM tasks.
    Returns False if any critical record is missing (skip inference).
    """
    # Worker
    q = await db.execute(
        select(User).where(User.id == ctx.worker_id, User.company_id == ctx.company_id)
    )
    ctx.worker = q.scalar_one_or_none()
    if ctx.worker is None:
        logger.debug("maintenance_inference worker_not_found worker_id=%s", ctx.worker_id)
        return False

    # Tool (BLE-tracked equipment — AutomationBleDevice.assigned_equipment_id → tools.id)
    q = await db.execute(
        select(Tool).where(Tool.id == ctx.equipment_id, Tool.company_id == ctx.company_id)
    )
    ctx.tool = q.scalar_one_or_none()
    if ctx.tool is None:
        logger.debug("maintenance_inference tool_not_found tool_id=%s", ctx.equipment_id)
        return False

    # FacilityEquipment — the full equipment record with type info.
    # Tool → FacilityEquipment via pulse_work_requests or directly via linked_tool_id.
    # We look up facility_equipment that has this tool's tag_id linked, or fall back
    # to equipment in the same zone with matching name.
    fe_q = await db.execute(
        select(FacilityEquipment).where(
            FacilityEquipment.company_id == ctx.company_id,
            FacilityEquipment.zone_id == ctx.tool.zone_id,
        ).limit(20)
    )
    facility_equip_list = fe_q.scalars().all()

    # Best match: equipment whose name contains the tool name (or vice versa)
    tool_name_lower = (ctx.tool.name or "").lower()
    for fe in facility_equip_list:
        fe_name_lower = (fe.name or "").lower()
        if tool_name_lower in fe_name_lower or fe_name_lower in tool_name_lower:
            ctx.facility_equipment = fe
            break

    # Fallback: take first equipment in the same zone (still useful for PM lookup)
    if ctx.facility_equipment is None and facility_equip_list:
        ctx.facility_equipment = facility_equip_list[0]

    # Open PM tasks for this facility equipment
    if ctx.facility_equipment is not None:
        now = datetime.now(timezone.utc)
        pm_q = await db.execute(
            select(PmTask).where(
                PmTask.equipment_id == ctx.facility_equipment.id,
            ).order_by(PmTask.next_due_at.asc())
        )
        all_pms = pm_q.scalars().all()

        # Only care about tasks that are due or overdue (next_due_at ≤ now + 7 days buffer)
        from datetime import timedelta
        window = now + timedelta(days=7)
        ctx.open_pm_tasks = [t for t in all_pms if t.next_due_at <= window]

        if ctx.open_pm_tasks:
            ctx.most_urgent_pm = ctx.open_pm_tasks[0]  # already sorted by next_due_at asc

    # Active shift check — is this worker scheduled right now?
    from app.models.pulse_models import PulseScheduleShift
    now_dt = datetime.now(timezone.utc)
    shift_q = await db.execute(
        select(PulseScheduleShift).where(
            PulseScheduleShift.company_id == ctx.company_id,
            PulseScheduleShift.assigned_user_id == ctx.worker_id,
            PulseScheduleShift.starts_at <= now_dt,
            PulseScheduleShift.ends_at >= now_dt,
        ).limit(1)
    )
    ctx.on_shift = shift_q.scalar_one_or_none() is not None

    return True


# ── Scoring ───────────────────────────────────────────────────────────────────

def _score(ctx: _InferenceContext) -> _SignalScores:
    scores = _SignalScores()
    now = datetime.now(timezone.utc)

    # 1. Proximity duration (0.0 – 1.0 mapped to signal weight)
    dur = ctx.duration_seconds
    if dur >= 300:    scores.proximity_duration = 1.0   # 5+ min — very confident
    elif dur >= 120:  scores.proximity_duration = 0.75  # 2–5 min
    elif dur >= 60:   scores.proximity_duration = 0.50  # 1–2 min
    elif dur >= 30:   scores.proximity_duration = 0.25  # 30s–1 min — weak signal
    # < 30s → 0 (not long enough to be meaningful)

    # 2. Open PM task exists
    if ctx.open_pm_tasks:
        scores.open_pm_exists = 1.0

    # 3. PM overdue (bonus on top of open PM)
    if ctx.most_urgent_pm is not None:
        overdue_days = max(0, (now - ctx.most_urgent_pm.next_due_at).days)
        if overdue_days > 0:
            # Overdue: scale 0.5 → 1.0 based on urgency (caps at 30 days overdue)
            scores.pm_overdue = min(1.0, 0.5 + (overdue_days / 30) * 0.5)

    # 4. Role match
    worker_role = (getattr(ctx.worker, "operational_role", None) or "").lower().replace(" ", "_")
    equip_type = (
        getattr(ctx.facility_equipment, "type", None) or
        getattr(ctx.tool, "name", None) or ""
    ).lower()

    affinity_keywords = ROLE_EQUIPMENT_AFFINITY.get(worker_role, None)
    if affinity_keywords is None:
        # Unknown role — neutral score
        scores.role_match = 0.5
    elif len(affinity_keywords) == 0:
        # Manager or general maintenance — matches everything
        scores.role_match = 1.0
    else:
        scores.role_match = 1.0 if any(kw in equip_type for kw in affinity_keywords) else 0.0

    # 5. Same zone
    tool_zone = getattr(ctx.tool, "zone_id", None)
    if tool_zone and str(tool_zone) == ctx.zone_id:
        scores.same_zone = 1.0

    # 6. On shift
    scores.on_shift = 1.0 if ctx.on_shift else 0.0

    return scores


# ── Notification actions ──────────────────────────────────────────────────────

async def _notify_worker(
    db: AsyncSession,
    ctx: _InferenceContext,
    scores: _SignalScores,
    confidence: float,
) -> None:
    """
    Send a push notification to the worker asking them to confirm maintenance.
    This shows up as the ProximityPromptBanner in the Expo app.
    """
    pm = ctx.most_urgent_pm
    equip_name = (
        getattr(ctx.facility_equipment, "name", None) or
        getattr(ctx.tool, "name", None) or
        "this equipment"
    )

    payload: dict[str, Any] = {
        "inference_type":    "maintenance_confirmation",
        "worker_id":         ctx.worker_id,
        "equipment_id":      ctx.equipment_id,
        "zone_id":           ctx.zone_id,
        "equipment_name":    equip_name,
        "confidence":        round(confidence, 3),
        "signal_scores":     scores.as_dict(),
        "duration_seconds":  ctx.duration_seconds,
        "source_event_id":   ctx.source_event_id,
        # PM context for the Expo prompt UI
        "pm_task_id":        pm.id if pm else None,
        "pm_task_name":      pm.name if pm else None,
        "pm_overdue_days":   max(0, (datetime.now(timezone.utc) - pm.next_due_at).days) if pm else 0,
        # Notification expires after 10 minutes — don't prompt someone who's already left
        "expires_at":        (datetime.now(timezone.utc).timestamp() + 600),
    }

    await create_notification(
        db,
        user_id=ctx.worker_id,
        company_id=ctx.company_id,
        ntype="maintenance_inference_request",
        payload=payload,
        status="pending",
    )

    logger.info(
        "maintenance_inference worker_notified worker=%s equipment=%s confidence=%.2f pm=%s",
        ctx.worker_id[:8],
        ctx.equipment_id[:8],
        confidence,
        pm.id[:8] if pm else "none",
    )


async def _flag_for_manager(
    db: AsyncSession,
    ctx: _InferenceContext,
    scores: _SignalScores,
    confidence: float,
) -> None:
    """
    Confidence is in the 70–89% band — not high enough to bother the worker,
    but worth surfacing to the maintenance manager for review.
    Creates a notification for any user with a manager role in this company.
    """
    equip_name = (
        getattr(ctx.facility_equipment, "name", None) or
        getattr(ctx.tool, "name", None) or
        "equipment"
    )

    payload: dict[str, Any] = {
        "inference_type":  "maintenance_flag",
        "worker_id":       ctx.worker_id,
        "equipment_id":    ctx.equipment_id,
        "zone_id":         ctx.zone_id,
        "equipment_name":  equip_name,
        "confidence":      round(confidence, 3),
        "signal_scores":   scores.as_dict(),
        "source_event_id": ctx.source_event_id,
        "pm_task_id":      ctx.most_urgent_pm.id if ctx.most_urgent_pm else None,
    }

    # Find managers in this company to notify
    from app.models.domain import UserRole
    mgr_q = await db.execute(
        select(User).where(
            User.company_id == ctx.company_id,
            User.role.in_([UserRole.admin.value, UserRole.company_admin.value]),
            User.is_active == True,  # noqa: E712
        ).limit(5)
    )
    managers = mgr_q.scalars().all()

    for mgr in managers:
        await create_notification(
            db,
            user_id=str(mgr.id),
            company_id=ctx.company_id,
            ntype="maintenance_inference_flag",
            payload=payload,
            status="pending",
        )

    logger.info(
        "maintenance_inference flagged_for_manager worker=%s equipment=%s confidence=%.2f managers=%d",
        ctx.worker_id[:8],
        ctx.equipment_id[:8],
        confidence,
        len(managers),
    )


async def _log_silent(
    db: AsyncSession,
    ctx: _InferenceContext,
    scores: _SignalScores,
    confidence: float,
) -> None:
    """Low confidence — log for analytics without sending any notification."""
    await log_event(
        db,
        company_id=ctx.company_id,
        log_type="maintenance_inference_low_confidence",
        message=f"inference below threshold: {confidence:.2f}",
        payload={
            "worker_id":    ctx.worker_id,
            "equipment_id": ctx.equipment_id,
            "zone_id":      ctx.zone_id,
            "confidence":   round(confidence, 3),
            "scores":       scores.as_dict(),
        },
        severity="info",
        source_module="maintenance_inference",
    )


# ── Duplicate guard ───────────────────────────────────────────────────────────

async def _already_pending(db: AsyncSession, ctx: _InferenceContext) -> bool:
    """
    Check if there's already a pending inference notification for this
    worker + equipment pair. Prevents spamming if proximity_logic fires repeatedly.
    Cooldown: 10 minutes.
    """
    ten_min_ago = datetime.fromtimestamp(time.time() - 600, tz=timezone.utc)
    q = await db.execute(
        select(AutomationNotification).where(
            AutomationNotification.company_id == ctx.company_id,
            AutomationNotification.user_id == ctx.worker_id,
            AutomationNotification.type.in_([
                "maintenance_inference_request",
                "maintenance_inference_flag",
            ]),
            AutomationNotification.status == "pending",
            AutomationNotification.created_at >= ten_min_ago,
        ).limit(1)
    )
    existing = q.scalar_one_or_none()
    if existing is not None:
        # Check if it's for the same equipment (payload check)
        payload = existing.payload or {}
        if payload.get("equipment_id") == ctx.equipment_id:
            return True
    return False


# ── Main entry point ──────────────────────────────────────────────────────────

async def handle(db: AsyncSession, event: AutomationEvent) -> None:
    """
    Entry point called by event_processor.py when event_type == "maintenance_signal".

    This is the stub that was previously `return`. Now it's the full inference engine.

    The event payload (set by proximity_logic.py → _emit_session_started/_emit_session_ended)
    contains: worker_id, equipment_id, zone_id, company_id, duration_seconds.
    """
    payload = dict(event.payload or {})

    company_id   = str(payload.get("company_id") or "").strip()
    worker_id    = str(payload.get("worker_id") or "").strip()
    equipment_id = str(payload.get("equipment_id") or "").strip()
    zone_id      = str(payload.get("zone_id") or "").strip()

    if not all([company_id, worker_id, equipment_id, zone_id]):
        logger.debug("maintenance_inference missing_required_fields event_id=%s", event.id)
        return

    duration_seconds = float(payload.get("duration_seconds") or 0.0)

    # Check feature flag — respects your existing config_service pattern
    cfg = await get_config(db, company_id, FEATURE_MAINTENANCE_INFERENCE)
    if not cfg.get("enabled", True):
        return

    ctx = _InferenceContext(
        company_id=company_id,
        worker_id=worker_id,
        equipment_id=equipment_id,
        zone_id=zone_id,
        duration_seconds=duration_seconds,
        source_event_id=event.id,
    )

    # Load all context data (worker, tool, facility_equipment, PM tasks, shift)
    ok = await _load_context(db, ctx)
    if not ok:
        return

    # Skip if there's already a pending inference for this pair (10 min cooldown)
    if await _already_pending(db, ctx):
        logger.debug(
            "maintenance_inference cooldown_active worker=%s equipment=%s",
            worker_id[:8], equipment_id[:8],
        )
        return

    # Score the inference
    scores = _score(ctx)
    confidence = scores.total()

    logger.debug(
        "maintenance_inference scored worker=%s equipment=%s confidence=%.2f scores=%s",
        worker_id[:8], equipment_id[:8], confidence, scores.as_dict(),
    )

    # Route by confidence threshold
    if confidence >= THRESHOLD_NOTIFY:
        await _notify_worker(db, ctx, scores, confidence)
    elif confidence >= THRESHOLD_FLAG:
        await _flag_for_manager(db, ctx, scores, confidence)
    else:
        await _log_silent(db, ctx, scores, confidence)

    # Always emit an automation_triggered event for analytics / audit trail
    await emit_automation_triggered(
        db,
        company_id=company_id,
        entity_id=equipment_id,
        payload={
            "inference_type": "maintenance",
            "worker_id":      worker_id,
            "equipment_id":   equipment_id,
            "zone_id":        zone_id,
            "confidence":     round(confidence, 3),
            "action":         (
                "worker_notified" if confidence >= THRESHOLD_NOTIFY
                else "manager_flagged" if confidence >= THRESHOLD_FLAG
                else "silent_log"
            ),
            "scores":         scores.as_dict(),
        },
        correlation_id=event.id,
    )
