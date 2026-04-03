"""Per-user guided onboarding: step keys, JSON state, completion helpers."""

from __future__ import annotations

import copy
from typing import Any, Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import User

ONBOARDING_STEP_KEYS: tuple[str, ...] = (
    "create_zone",
    "add_device",
    "create_work_order",
    "view_operations",
)

STEP_LABELS: dict[str, str] = {
    "create_zone": "Create your first zone",
    "add_device": "Add a device",
    "create_work_order": "Create a work order",
    "view_operations": "View operations dashboard",
}


def default_onboarding_steps() -> list[dict[str, Any]]:
    return [{"key": k, "completed": False} for k in ONBOARDING_STEP_KEYS]


def _normalize_steps(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return default_onboarding_steps()
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in raw:
        if not isinstance(item, dict):
            continue
        key = item.get("key")
        if key not in ONBOARDING_STEP_KEYS or key in seen:
            continue
        seen.add(key)
        out.append({"key": key, "completed": bool(item.get("completed"))})
    for k in ONBOARDING_STEP_KEYS:
        if k not in seen:
            out.append({"key": k, "completed": False})
    return out


def steps_with_labels(steps: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for s in steps:
        k = s["key"]
        rows.append(
            {
                "key": k,
                "label": STEP_LABELS.get(k, k),
                "completed": bool(s.get("completed")),
            }
        )
    return rows


def _all_complete(steps: list[dict[str, Any]]) -> bool:
    return all(bool(s.get("completed")) for s in steps)


async def try_mark_onboarding_step(db: AsyncSession, user_id: str, step_key: str) -> None:
    if step_key not in ONBOARDING_STEP_KEYS:
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
    if _all_complete(steps):
        user.onboarding_completed = True
    await db.flush()


def build_onboarding_state_out(user: User) -> dict[str, Any]:
    steps = _normalize_steps(user.onboarding_steps)
    labeled = steps_with_labels(steps)
    done = sum(1 for s in steps if s["completed"])
    return {
        "onboarding_enabled": user.onboarding_enabled,
        "onboarding_completed": user.onboarding_completed,
        "steps": labeled,
        "completed_count": done,
        "total_count": len(ONBOARDING_STEP_KEYS),
    }
