"""Per-user guided onboarding: step keys, role-filtered API surface, completion helpers."""

from __future__ import annotations

import copy
from typing import Any, Iterable, Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.user_roles import user_has_any_role
from app.models.domain import User, UserRole

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
)

# Exposed for PATCH validation — must match union of role flows.
ONBOARDING_STEP_KEYS: tuple[str, ...] = ALL_ONBOARDING_STEP_KEYS

MANAGER_ONBOARDING_KEYS: tuple[str, ...] = (
    "create_zone",
    "add_device",
    "add_equipment",
    "create_work_order",
    "view_operations",
)

WORKER_ONBOARDING_KEYS: tuple[str, ...] = (
    "view_operations",
    "complete_work_order",
    "view_schedule",
    "log_issue",
)

STEP_LABELS: dict[str, str] = {
    "create_zone": "Create your first zone",
    "add_device": "Add a device",
    "add_equipment": "Add facility equipment",
    "create_work_order": "Create a work order",
    "view_operations": "View operations dashboard",
    "complete_work_order": "Complete a work order",
    "view_schedule": "View your schedule",
    "log_issue": "Log an issue",
}

STEP_DESCRIPTIONS: dict[str, str] = {
    "create_zone": "Organize your facility into manageable areas.",
    "add_device": "Register a gateway, tag, or equipment record.",
    "add_equipment": "Record a fixed asset in the equipment registry for maintenance tracking.",
    "create_work_order": "Open a tracked maintenance or facility task.",
    "view_operations": "See performance, accountability, and bottlenecks.",
    "complete_work_order": "Mark an assigned or open work order as done.",
    "view_schedule": "Review shifts and coverage for your team.",
    "log_issue": "Report a problem so it can be tracked and resolved.",
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


def steps_with_labels_and_descriptions(filtered_steps: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for s in filtered_steps:
        k = s["key"]
        rows.append(
            {
                "key": k,
                "label": STEP_LABELS.get(k, k.replace("_", " ").title()),
                "description": STEP_DESCRIPTIONS.get(k, ""),
                "completed": bool(s.get("completed")),
            }
        )
    return rows


def visible_progress(full_steps: list[dict[str, Any]], role: UserRole) -> tuple[int, int]:
    keys = step_keys_for_role(role)
    m = _steps_map(full_steps)
    done = sum(1 for k in keys if m.get(k, {}).get("completed"))
    return done, len(keys)


def visible_progress_for_user(full_steps: list[dict[str, Any]], user: User) -> tuple[int, int]:
    keys = step_keys_for_user(user)
    m = _steps_map(full_steps)
    done = sum(1 for k in keys if m.get(k, {}).get("completed"))
    return done, len(keys)


def role_onboarding_complete(full_steps: list[dict[str, Any]], role: UserRole) -> bool:
    keys = step_keys_for_role(role)
    m = _steps_map(full_steps)
    return all(m.get(k, {}).get("completed") for k in keys)


def user_onboarding_complete(full_mutable: list[dict[str, Any]], user: User) -> bool:
    keys = step_keys_for_user(user)
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


def build_onboarding_state_out(user: User) -> dict[str, Any]:
    full = _normalize_steps(user.onboarding_steps)
    filtered = filter_steps_for_user(full, user)
    labeled = steps_with_labels_and_descriptions(filtered)
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
