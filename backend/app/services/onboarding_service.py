"""Per-user guided onboarding: step keys, role-filtered API surface, completion helpers."""

from __future__ import annotations

import copy
from typing import Any, Iterable, Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.user_roles import user_has_any_role
from app.models.domain import User, UserRole
from app.services.onboarding_reality import load_onboarding_reality

# Full universe of steps stored per user (JSON). New keys are merged in `_normalize_steps`.
ALL_ONBOARDING_STEP_KEYS: tuple[str, ...] = (
    "create_zone",
    "add_device",
    "add_equipment",
    "create_work_order",
    "view_operations",
    "complete_work_order",
    "view_schedule",
    "log_issue",
    "add_workers",
    "first_maintenance",
)

# Exposed for PATCH validation — must match union of role flows.
ONBOARDING_STEP_KEYS: tuple[str, ...] = ALL_ONBOARDING_STEP_KEYS

MANAGER_OPTIONAL_STEP_KEYS: frozenset[str] = frozenset({"add_workers"})

MANAGER_ONBOARDING_KEYS: tuple[str, ...] = (
    "create_zone",
    "add_device",
    "view_operations",
    "add_workers",
    "first_maintenance",
)

WORKER_ONBOARDING_KEYS: tuple[str, ...] = (
    "view_operations",
    "complete_work_order",
    "view_schedule",
    "log_issue",
)

STEP_LABELS: dict[str, str] = {
    "create_zone": "Create facility zones",
    "add_device": "Connect a gateway or tag (or use demo data)",
    "add_equipment": "Add facility equipment",
    "create_work_order": "Create a work order",
    "view_operations": "View live or simulated system data",
    "complete_work_order": "Complete a work order",
    "view_schedule": "View your schedule",
    "log_issue": "Log an issue",
    "add_workers": "Add workers (optional)",
    "first_maintenance": "First work order or procedure",
}

STEP_DESCRIPTIONS: dict[str, str] = {
    "create_zone": "Define areas so devices and work line up with the floor.",
    "add_device": "Register a gateway or BLE tag — or turn on sample sensors instantly.",
    "add_equipment": "Record a fixed asset in the equipment registry for maintenance tracking.",
    "create_work_order": "Open a tracked maintenance or facility task.",
    "view_operations": "Open Monitoring to see charts and telemetry as soon as data exists.",
    "complete_work_order": "Mark an assigned or open work order as done.",
    "view_schedule": "Review shifts and coverage for your team.",
    "log_issue": "Report a problem so it can be tracked and resolved.",
    "add_workers": "Invite field staff when you are ready — not required to explore Pulse.",
    "first_maintenance": "Create a work order or add a procedure task under Projects.",
}

STEP_HREFS: dict[str, str] = {
    "create_zone": "/dashboard/setup?tab=zones",
    "add_device": "/dashboard/setup?tab=devices",
    "add_equipment": "/equipment",
    "create_work_order": "/dashboard/maintenance/work-orders",
    "view_operations": "/monitoring",
    "complete_work_order": "/dashboard/maintenance/work-orders",
    "view_schedule": "/schedule",
    "log_issue": "/dashboard/maintenance/work-requests",
    "add_workers": "/dashboard/workers",
    "first_maintenance": "/dashboard/maintenance/work-orders",
}

OnboardingFlowLiteral = Literal["manager", "worker"]


def _is_manager_flow(role: UserRole) -> bool:
    return role in (UserRole.company_admin, UserRole.manager, UserRole.supervisor)


def is_manager_onboarding_user(user: User) -> bool:
    return user_has_any_role(user, UserRole.company_admin, UserRole.manager, UserRole.supervisor)


def step_keys_for_role(role: UserRole) -> tuple[str, ...]:
    return MANAGER_ONBOARDING_KEYS if _is_manager_flow(role) else WORKER_ONBOARDING_KEYS


def step_keys_for_user(user: User) -> tuple[str, ...]:
    return MANAGER_ONBOARDING_KEYS if is_manager_onboarding_user(user) else WORKER_ONBOARDING_KEYS


def completion_keys_for_role(role: UserRole) -> tuple[str, ...]:
    keys = step_keys_for_role(role)
    if _is_manager_flow(role):
        return tuple(k for k in keys if k not in MANAGER_OPTIONAL_STEP_KEYS)
    return keys


def completion_keys_for_user(user: User) -> tuple[str, ...]:
    keys = step_keys_for_user(user)
    if is_manager_onboarding_user(user):
        return tuple(k for k in keys if k not in MANAGER_OPTIONAL_STEP_KEYS)
    return keys


def flow_for_role(role: UserRole) -> OnboardingFlowLiteral:
    return "manager" if _is_manager_flow(role) else "worker"


def flow_for_user(user: User) -> OnboardingFlowLiteral:
    return "manager" if is_manager_onboarding_user(user) else "worker"


def default_onboarding_steps() -> list[dict[str, Any]]:
    return [{"key": k, "completed": False} for k in ALL_ONBOARDING_STEP_KEYS]


def _normalize_steps(raw: Any) -> list[dict[str, Any]]:
    """Merge DB JSON with full key set; preserve completion flags for known keys."""
    if not isinstance(raw, list):
        return default_onboarding_steps()
    by_key: dict[str, bool] = {}
    for item in raw:
        if not isinstance(item, dict):
            continue
        key = item.get("key")
        if key not in ALL_ONBOARDING_STEP_KEYS:
            continue
        by_key[key] = bool(item.get("completed"))
    return [{"key": k, "completed": by_key.get(k, False)} for k in ALL_ONBOARDING_STEP_KEYS]


def _steps_map(steps: Iterable[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {str(s["key"]): s for s in steps}


def filter_steps_for_role(full_steps: list[dict[str, Any]], role: UserRole) -> list[dict[str, Any]]:
    m = _steps_map(full_steps)
    return [copy.deepcopy(m[k]) for k in step_keys_for_role(role) if k in m]


def filter_steps_for_user(full_steps: list[dict[str, Any]], user: User) -> list[dict[str, Any]]:
    m = _steps_map(full_steps)
    return [copy.deepcopy(m[k]) for k in step_keys_for_user(user) if k in m]


def steps_with_labels_and_descriptions(filtered_steps: Iterable[dict[str, Any]], user: User) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for s in filtered_steps:
        k = s["key"]
        optional = is_manager_onboarding_user(user) and k in MANAGER_OPTIONAL_STEP_KEYS
        rows.append(
            {
                "key": k,
                "label": STEP_LABELS.get(k, k.replace("_", " ").title()),
                "description": STEP_DESCRIPTIONS.get(k, ""),
                "completed": bool(s.get("completed")),
                "optional": optional,
                "href": STEP_HREFS.get(k, "/overview"),
            }
        )
    return rows


def visible_progress(full_steps: list[dict[str, Any]], role: UserRole) -> tuple[int, int]:
    keys = completion_keys_for_role(role)
    m = _steps_map(full_steps)
    done = sum(1 for k in keys if m.get(k, {}).get("completed"))
    return done, len(keys)


def visible_progress_for_user(full_steps: list[dict[str, Any]], user: User) -> tuple[int, int]:
    keys = completion_keys_for_user(user)
    m = _steps_map(full_steps)
    done = sum(1 for k in keys if m.get(k, {}).get("completed"))
    return done, len(keys)


def role_onboarding_complete(full_steps: list[dict[str, Any]], role: UserRole) -> bool:
    keys = completion_keys_for_role(role)
    m = _steps_map(full_steps)
    return all(m.get(k, {}).get("completed") for k in keys)


def user_onboarding_complete(full_mutable: list[dict[str, Any]], user: User) -> bool:
    keys = completion_keys_for_user(user)
    m = _steps_map(full_mutable)
    return all(m.get(k, {}).get("completed") for k in keys)


async def try_mark_onboarding_step(db: AsyncSession, user_id: str, step_key: str) -> None:
    if step_key not in ALL_ONBOARDING_STEP_KEYS:
        return
    q = await db.execute(select(User).where(User.id == user_id))
    user = q.scalar_one_or_none()
    if user is None or user.company_id is None:
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
    if user_onboarding_complete(steps, user):
        user.onboarding_completed = True
    await db.flush()


async def sync_user_onboarding_from_reality(db: AsyncSession, user: User) -> bool:
    """Infer checklist completion from tenant data. Returns True if the user row was updated."""
    if user.company_id is None:
        return False
    if not user.onboarding_enabled:
        return False

    reality = await load_onboarding_reality(db, str(user.company_id), for_user_id=str(user.id))
    steps = _normalize_steps(user.onboarding_steps)
    prev = {s["key"]: bool(s["completed"]) for s in steps}
    m = {k: prev.get(k, False) for k in ALL_ONBOARDING_STEP_KEYS}

    device_ok = reality.gateway_count + reality.ble_device_count > 0 or reality.onboarding_demo_sensors
    data_ok = reality.has_recent_sensor_readings or reality.onboarding_demo_sensors
    maint_ok = (
        reality.work_request_count > 0
        or reality.procedure_task_count > 0
        or m.get("create_work_order", False)
    )

    m["create_zone"] = m["create_zone"] or reality.zone_count > 0
    m["add_device"] = m["add_device"] or device_ok
    m["add_equipment"] = m["add_equipment"] or reality.equipment_count > 0
    m["view_operations"] = m["view_operations"] or data_ok
    m["add_workers"] = m["add_workers"] or reality.worker_user_count > 0
    m["first_maintenance"] = m["first_maintenance"] or maint_ok
    m["complete_work_order"] = m["complete_work_order"] or reality.user_completed_wr_count > 0
    m["log_issue"] = m["log_issue"] or reality.user_created_wr_count > 0
    m["view_schedule"] = m["view_schedule"] or reality.user_shift_count > 0

    new_steps = [{"key": k, "completed": m[k]} for k in ALL_ONBOARDING_STEP_KEYS]
    if {s["key"]: s["completed"] for s in new_steps} == prev:
        return False

    user.onboarding_steps = copy.deepcopy(new_steps)
    recompute_onboarding_completed(user, new_steps)
    await db.flush()
    return True


def build_onboarding_state_out(user: User) -> dict[str, Any]:
    full = _normalize_steps(user.onboarding_steps)
    filtered = filter_steps_for_user(full, user)
    labeled = steps_with_labels_and_descriptions(filtered, user)
    done, total = visible_progress_for_user(full, user)
    flow_lit: OnboardingFlowLiteral = flow_for_user(user)
    return {
        "onboarding_enabled": user.onboarding_enabled,
        "onboarding_completed": user.onboarding_completed,
        "steps": labeled,
        "completed_count": done,
        "total_count": total,
        "flow": flow_lit,
    }


def recompute_onboarding_completed(user: User, full_steps: list[dict[str, Any]] | None = None) -> None:
    """Sync `onboarding_completed` from stored steps and role (e.g. after PATCH)."""
    steps = full_steps if full_steps is not None else _normalize_steps(user.onboarding_steps)
    user.onboarding_completed = user_onboarding_complete(steps, user)
