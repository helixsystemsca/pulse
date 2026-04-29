"""Per-user onboarding: company_admin org checklist (4 steps) + non-admin modal tour flag."""

from __future__ import annotations

import copy
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable, Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.user_roles import user_has_any_role
from app.models.domain import User, UserRole
from app.services.onboarding_reality import load_onboarding_reality

# Stored checklist (company admins only). Legacy JSON keys are merged in `_normalize_steps`.
ADMIN_CHECKLIST_KEYS: tuple[str, ...] = (
    "create_work_order",
    "add_equipment",
    "invite_team",
    "customize_workflow",
    "create_shift_definitions",
    "create_schedule_period",
    "publish_first_schedule",
)

ALL_ONBOARDING_STEP_KEYS: tuple[str, ...] = ADMIN_CHECKLIST_KEYS

ONBOARDING_STEP_KEYS: tuple[str, ...] = ALL_ONBOARDING_STEP_KEYS

LEGACY_STEP_MERGE: dict[str, str] = {
    "add_workers": "invite_team",
    "first_maintenance": "customize_workflow",
}

STEP_LABELS: dict[str, str] = {
    "create_work_order": "Create your first work order",
    "add_equipment": "Add an asset",
    "invite_team": "Invite your team",
    "customize_workflow": "Customize your workflow",
    "create_shift_definitions": "Define your shifts",
    "create_schedule_period": "Open availability collection",
    "publish_first_schedule": "Publish your first schedule",
}

STEP_DESCRIPTIONS: dict[str, str] = {
    "create_work_order": "Open Maintenance and create a tracked work order for your facility.",
    "add_equipment": "Register equipment so maintenance and history stay organized.",
    "invite_team": "Add another user to your organization from Workers & roles.",
    "customize_workflow": "Add a procedure task or a second work order to shape how work flows.",
    "create_shift_definitions": "Set up shift codes (D1, PM1, N1) with times and cert requirements.",
    "create_schedule_period": "Create a period so workers can submit their availability.",
    "publish_first_schedule": "Build and publish a schedule — workers will be notified automatically.",
}

STEP_HREFS: dict[str, str] = {
    "create_work_order": "/dashboard/maintenance",
    "add_equipment": "/equipment",
    "invite_team": "/dashboard/workers",
    "customize_workflow": "/dashboard/workers",
    "create_shift_definitions": "/schedule/shift-definitions",
    "create_schedule_period": "/schedule",
    "publish_first_schedule": "/schedule",
}

OnboardingFlowOut = Literal["manager", "worker"]
_TIER2_UNLOCK_DELAY_DAYS = 3

TIER1_MODULE_CHECKLISTS: tuple[dict[str, Any], ...] = (
    {
        "module": "dashboard",
        "title": "Dashboard",
        "items": (
            {"key": "alerts_visible", "label": "Review active alerts", "href": "/overview"},
            {"key": "workforce_visible", "label": "Open workforce overview", "href": "/overview"},
        ),
    },
    {
        "module": "work_requests",
        "title": "Work Requests",
        "items": (
            {"key": "work_request_created", "label": "Create a work request", "href": "/dashboard/maintenance"},
            {"key": "work_request_assigned", "label": "Assign a work request", "href": "/dashboard/maintenance"},
        ),
    },
    {
        "module": "inventory",
        "title": "Inventory",
        "items": (
            {"key": "equipment_added", "label": "Add equipment or tools", "href": "/equipment"},
            {"key": "inventory_reviewed", "label": "Review low-stock inventory", "href": "/dashboard/inventory"},
        ),
    },
)


def is_company_admin_checklist_user(user: User) -> bool:
    return bool(user.company_id) and user_has_any_role(user, UserRole.company_admin)


def onboarding_display_role(user: User) -> str:
    """UI persona for modal slides (admin excluded from modal)."""
    if user_has_any_role(user, UserRole.company_admin):
        return "admin"
    if user_has_any_role(user, UserRole.manager):
        return "manager"
    if user_has_any_role(user, UserRole.supervisor):
        return "supervisor"
    if user_has_any_role(user, UserRole.lead):
        return "lead"
    return "worker"


def default_onboarding_steps() -> list[dict[str, Any]]:
    return [{"key": k, "completed": False} for k in ALL_ONBOARDING_STEP_KEYS]


def _normalize_steps(raw: Any) -> list[dict[str, Any]]:
    by_key: dict[str, bool] = {k: False for k in ALL_ONBOARDING_STEP_KEYS}
    if not isinstance(raw, list):
        return [{"key": k, "completed": by_key[k]} for k in ALL_ONBOARDING_STEP_KEYS]
    for item in raw:
        if not isinstance(item, dict):
            continue
        key = item.get("key")
        if not isinstance(key, str):
            continue
        completed = bool(item.get("completed"))
        if key in ALL_ONBOARDING_STEP_KEYS:
            by_key[key] = by_key[key] or completed
            continue
        tgt = LEGACY_STEP_MERGE.get(key)
        if tgt:
            by_key[tgt] = by_key[tgt] or completed
    return [{"key": k, "completed": by_key[k]} for k in ALL_ONBOARDING_STEP_KEYS]


def _steps_map(steps: Iterable[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {str(s["key"]): s for s in steps}


def admin_steps_labeled(full_steps: list[dict[str, Any]]) -> list[dict[str, Any]]:
    m = _steps_map(full_steps)
    rows: list[dict[str, Any]] = []
    for k in ADMIN_CHECKLIST_KEYS:
        s = m[k]
        rows.append(
            {
                "key": k,
                "label": STEP_LABELS.get(k, k.replace("_", " ").title()),
                "description": STEP_DESCRIPTIONS.get(k, ""),
                "completed": bool(s.get("completed")),
                "optional": False,
                "href": STEP_HREFS.get(k, "/overview"),
            }
        )
    return rows


def admin_checklist_progress(full_steps: list[dict[str, Any]]) -> dict[str, bool]:
    m = _steps_map(full_steps)
    return {k: bool(m[k].get("completed")) for k in ADMIN_CHECKLIST_KEYS}


def admin_visible_progress(full_steps: list[dict[str, Any]]) -> tuple[int, int]:
    m = _steps_map(full_steps)
    done = sum(1 for k in ADMIN_CHECKLIST_KEYS if m.get(k, {}).get("completed"))
    return done, len(ADMIN_CHECKLIST_KEYS)


def admin_checklist_complete(full_steps: list[dict[str, Any]]) -> bool:
    m = _steps_map(full_steps)
    return all(m.get(k, {}).get("completed") for k in ADMIN_CHECKLIST_KEYS)


def flow_for_onboarding_api(user: User) -> OnboardingFlowOut:
    """Legacy `flow` field: manager-like vs worker for older clients."""
    r = onboarding_display_role(user)
    return "manager" if r in ("admin", "manager", "supervisor", "lead") else "worker"


async def try_mark_onboarding_step(db: AsyncSession, user_id: str, step_key: str) -> None:
    if step_key not in ALL_ONBOARDING_STEP_KEYS:
        return
    q = await db.execute(select(User).where(User.id == user_id))
    user = q.scalar_one_or_none()
    if user is None or user.company_id is None:
        return
    if not user_has_any_role(user, UserRole.company_admin):
        return
    if not user.onboarding_enabled or user.onboarding_completed:
        return
    steps = _normalize_steps(user.onboarding_steps)
    changed = False
    for s in steps:
        if s["key"] == step_key and not s["completed"]:
            s["completed"] = True
            changed = True
            break
    if not changed:
        return
    user.onboarding_steps = copy.deepcopy(steps)
    recompute_onboarding_completed(user, steps)
    await db.flush()


async def sync_user_onboarding_from_reality(db: AsyncSession, user: User) -> bool:
    """Infer admin checklist completion from tenant data. Returns True if the user row was updated."""
    if user.company_id is None:
        return False
    if not user.onboarding_enabled:
        return False

    reality = await load_onboarding_reality(db, str(user.company_id), for_user_id=str(user.id))
    tier1_prev = getattr(user, "onboarding_tier1_progress", None) or {}
    if not isinstance(tier1_prev, dict):
        tier1_prev = {}
    tier1_new = dict(tier1_prev)
    tier1_new["alerts_visible"] = bool(reality.has_recent_sensor_readings or reality.onboarding_demo_sensors)
    tier1_new["workforce_visible"] = bool(reality.worker_user_count > 0 or reality.active_company_user_count > 0)
    tier1_new["work_request_created"] = bool(reality.work_request_count > 0)
    tier1_new["work_request_assigned"] = bool(reality.user_shift_count > 0 or reality.user_completed_wr_count > 0)
    tier1_new["equipment_added"] = bool(reality.equipment_count > 0)
    tier1_new["inventory_reviewed"] = bool(reality.equipment_count > 0 or reality.work_request_count > 0)

    steps = _normalize_steps(user.onboarding_steps)
    prev = {s["key"]: bool(s["completed"]) for s in steps}
    m = {k: prev.get(k, False) for k in ALL_ONBOARDING_STEP_KEYS}
    if user_has_any_role(user, UserRole.company_admin):
        m["create_work_order"] = m["create_work_order"] or reality.work_request_count > 0
        m["add_equipment"] = m["add_equipment"] or reality.equipment_count > 0
        m["invite_team"] = m["invite_team"] or reality.active_company_user_count >= 2
        m["customize_workflow"] = (
            m["customize_workflow"] or reality.procedure_task_count > 0 or reality.work_request_count >= 2
        )
        m["create_shift_definitions"] = m["create_shift_definitions"] or reality.shift_definitions_created
        m["create_schedule_period"] = m["create_schedule_period"] or reality.period_created
        m["publish_first_schedule"] = m["publish_first_schedule"] or reality.schedule_published
    new_steps = [{"key": k, "completed": m[k]} for k in ALL_ONBOARDING_STEP_KEYS]
    steps_unchanged = {s["key"]: s["completed"] for s in new_steps} == prev
    tier1_unchanged = tier1_new == tier1_prev
    if steps_unchanged and tier1_unchanged:
        return False

    if not steps_unchanged:
        user.onboarding_steps = copy.deepcopy(new_steps)
    user.onboarding_tier1_progress = copy.deepcopy(tier1_new)
    recompute_onboarding_completed(user, new_steps)
    await db.flush()
    return True


def build_onboarding_state_out(user: User) -> dict[str, Any]:
    full = _normalize_steps(user.onboarding_steps)
    role_lit = onboarding_display_role(user)
    tour_done = bool(getattr(user, "user_onboarding_tour_completed", False))

    if is_company_admin_checklist_user(user):
        labeled = admin_steps_labeled(full)
        done, total = admin_visible_progress(full)
        org_done = bool(user.onboarding_completed)
        checklist_progress = admin_checklist_progress(full)
    else:
        labeled = []
        done, total = 0, 0
        org_done = False
        checklist_progress = None

    stored_tier1 = getattr(user, "onboarding_tier1_progress", None) or {}
    if not isinstance(stored_tier1, dict):
        stored_tier1 = {}
    now = datetime.now(timezone.utc)
    tier1_modules: list[dict[str, Any]] = []
    tier1_done = 0
    tier1_total = 0
    for mod in TIER1_MODULE_CHECKLISTS:
        item_rows: list[dict[str, Any]] = []
        done_count = 0
        for item in mod["items"]:
            completed = bool(stored_tier1.get(item["key"], False))
            if completed:
                done_count += 1
                tier1_done += 1
            tier1_total += 1
            item_rows.append(
                {
                    "key": item["key"],
                    "label": item["label"],
                    "completed": completed,
                    "href": item["href"],
                }
            )
        tier1_modules.append(
            {
                "module": mod["module"],
                "title": mod["title"],
                "completed_count": done_count,
                "total_count": len(mod["items"]),
                "items": item_rows,
            }
        )

    started_at = getattr(user, "onboarding_started_at", None) or now
    delay_elapsed = now >= (started_at + timedelta(days=_TIER2_UNLOCK_DELAY_DAYS))
    tier2_eligible = bool(tier1_total and tier1_done >= tier1_total) or delay_elapsed
    tier2_enabled = bool(getattr(user, "onboarding_tier2_enabled", False))

    return {
        "onboarding_enabled": user.onboarding_enabled,
        "onboarding_completed": user.onboarding_completed,
        "org_onboarding_completed": org_done,
        "user_onboarding_tour_completed": tour_done,
        "onboarding_role": role_lit,
        "checklist_progress": checklist_progress,
        "steps": labeled,
        "completed_count": done,
        "total_count": total,
        "flow": flow_for_onboarding_api(user),
        "tier1_modules": tier1_modules,
        "tier1_completed_count": tier1_done,
        "tier1_total_count": tier1_total,
        "tier2_enabled": tier2_enabled,
        "tier2_eligible": tier2_eligible,
    }


def recompute_onboarding_completed(user: User, full_steps: list[dict[str, Any]] | None = None) -> None:
    steps = full_steps if full_steps is not None else _normalize_steps(user.onboarding_steps)
    if is_company_admin_checklist_user(user):
        user.onboarding_completed = admin_checklist_complete(steps)
    else:
        user.onboarding_completed = False


# Backwards-compatible name (older callers / imports).
def is_manager_onboarding_user(user: User) -> bool:
    return is_company_admin_checklist_user(user)
