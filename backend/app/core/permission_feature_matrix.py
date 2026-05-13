"""Team Management `department_role_feature_access`: allowed departments/slots + HR-aware resolution."""

from __future__ import annotations

from typing import Any

from app.core.features.system_catalog import GLOBAL_SYSTEM_FEATURES
from app.core.user_roles import user_has_any_role
from app.core.workspace_departments import normalize_workspace_department_slug, normalize_workspace_department_slug_list
from app.models.domain import User, UserRole
from app.models.pulse_models import PulseWorkerHR

PERMISSION_MATRIX_DEPARTMENTS: frozenset[str] = frozenset(
    {"maintenance", "communications", "aquatics", "reception", "fitness", "racquets"}
)
PERMISSION_MATRIX_SLOTS: frozenset[str] = frozenset(
    {"manager", "coordination", "supervisor", "lead", "operations", "team_member"}
)

_FEATURE_CAT = frozenset(GLOBAL_SYSTEM_FEATURES)


def sanitize_department_role_feature_access(raw: object) -> dict[str, dict[str, list[str]]]:
    if not isinstance(raw, dict):
        return {}
    out: dict[str, dict[str, list[str]]] = {}
    for dk, dv in raw.items():
        ds = str(dk)
        if ds not in PERMISSION_MATRIX_DEPARTMENTS:
            continue
        if not isinstance(dv, dict):
            continue
        inner: dict[str, list[str]] = {}
        for sk, sv in dv.items():
            ss = str(sk)
            if ss not in PERMISSION_MATRIX_SLOTS:
                continue
            if not isinstance(sv, list):
                inner[ss] = []
            else:
                inner[ss] = sorted({str(x) for x in sv if str(x) in _FEATURE_CAT})
        if inner:
            out[ds] = inner
    return out


def permission_matrix_department_for_user(user: User, hr: PulseWorkerHR | None) -> str:
    raw = getattr(hr, "department_slugs", None) if hr else None
    if isinstance(raw, list):
        for x in raw:
            n = normalize_workspace_department_slug(str(x))
            if n and n in PERMISSION_MATRIX_DEPARTMENTS:
                return n
    if hr and hr.department:
        n = normalize_workspace_department_slug(hr.department.strip())
        if n and n in PERMISSION_MATRIX_DEPARTMENTS:
            return n
    return "maintenance"


def permission_matrix_slot_for_user(user: User, hr: PulseWorkerHR | None) -> str:
    if user_has_any_role(user, UserRole.manager):
        return "manager"
    if user_has_any_role(user, UserRole.supervisor):
        return "supervisor"
    if user_has_any_role(user, UserRole.lead):
        return "lead"
    jt = ((hr.job_title if hr else None) or "").lower()
    if "coordination" in jt or "coordinator" in jt:
        return "coordination"
    if "operations" in jt:
        return "operations"
    return "team_member"
