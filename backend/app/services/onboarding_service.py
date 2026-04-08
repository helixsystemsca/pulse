"""Per-user onboarding: company_admin org checklist (4 steps) + non-admin modal tour flag."""

from __future__ import annotations

import copy
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
}

STEP_DESCRIPTIONS: dict[str, str] = {
    "create_work_order": "Open Maintenance and create a tracked work order for your facility.",
    "add_equipment": "Register equipment so maintenance and history stay organized.",
    "invite_team": "Add another user to your organization from Workers & roles.",
    "customize_workflow": "Add a procedure task or a second work order to shape how work flows.",
}

STEP_HREFS: dict[str, str] = {
    "create_work_order": "/dashboard/maintenance/work-orders",
    "add_equipment": "/equipment",
    "invite_team": "/dashboard/workers",
    "customize_workflow": "/dashboard/workers",
}

OnboardingFlowOut = Literal["manager", "worker"]


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
    if not user_has_any_role(user, UserRole.company_admin):
        return False

    reality = await load_onboarding_reality(db, str(user.company_id), for_user_id=str(user.id))
    steps = _normalize_steps(user.onboarding_steps)
    prev = {s["key"]: bool(s["completed"]) for s in steps}
    m = {k: prev.get(k, False) for k in ALL_ONBOARDING_STEP_KEYS}

    m["create_work_order"] = m["create_work_order"] or reality.work_request_count > 0
    m["add_equipment"] = m["add_equipment"] or reality.equipment_count > 0
    m["invite_team"] = m["invite_team"] or reality.active_company_user_count >= 2
    m["customize_workflow"] = (
        m["customize_workflow"] or reality.procedure_task_count > 0 or reality.work_request_count >= 2
    )

    new_steps = [{"key": k, "completed": m[k]} for k in ALL_ONBOARDING_STEP_KEYS]
    if {s["key"]: s["completed"] for s in new_steps} == prev:
        return False

    user.onboarding_steps = copy.deepcopy(new_steps)
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
