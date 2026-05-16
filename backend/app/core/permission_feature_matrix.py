"""Team Management `department_role_feature_access`: allowed departments/slots + HR-aware resolution."""

from __future__ import annotations

from typing import Any, Literal

from app.core.department_matrix_baselines import (
    DEPARTMENT_BASELINE_SLOTS,
    LEGACY_TEAM_MEMBER_SLOT,
    UNRESOLVED_MATRIX_SLOT,
    department_baseline_slot,
)
from app.core.features.system_catalog import GLOBAL_SYSTEM_FEATURES
from app.core.user_roles import user_has_any_role
from app.core.workspace_departments import normalize_workspace_department_slug, normalize_workspace_department_slug_list
from app.models.domain import User, UserRole
from app.models.pulse_models import PulseWorkerHR

PERMISSION_MATRIX_DEPARTMENTS: frozenset[str] = frozenset(
    {"maintenance", "communications", "aquatics", "reception", "fitness", "racquets", "admin"}
)

PERMISSION_MATRIX_SLOTS: frozenset[str] = frozenset(
    {
        "manager",
        "coordination",
        "supervisor",
        "lead",
        "operations",
        "aquatics_staff",
        "fitness_staff",
        "racquets_staff",
        "admin_staff",
        LEGACY_TEAM_MEMBER_SLOT,
        UNRESOLVED_MATRIX_SLOT,
    }
)

MatrixSlotSource = Literal[
    "explicit_matrix_slot",
    "jwt_role",
    "job_title_inference",
    "department_baseline",
    "department_default",  # deprecated alias — same semantics as department_baseline
    "unresolved",
    "fallback_default",  # deprecated — maps to unresolved in resolver
    "explicit_required_policy",
]

_FEATURE_CAT = frozenset(GLOBAL_SYSTEM_FEATURES)


def normalize_matrix_slot(raw: object | None) -> str | None:
    """Normalize stored HR `matrix_slot` to a canonical slot key, or None if unset/invalid."""
    if raw is None:
        return None
    s = str(raw).strip().lower().replace("-", "_").replace(" ", "_")
    if not s:
        return None
    if s in PERMISSION_MATRIX_SLOTS:
        return s
    return None


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


def matrix_cell_features(
    matrix: dict[str, Any],
    *,
    department: str,
    slot: str,
) -> list[str]:
    """
    Features from ``department_role_feature_access[department][slot]``.

    Read-time compatibility: baseline slot → legacy ``team_member`` cell when baseline empty.
    """
    if slot == UNRESOLVED_MATRIX_SLOT:
        return []
    row = matrix.get(department)
    if not isinstance(row, dict):
        return []
    raw = row.get(slot)
    if isinstance(raw, list) and raw:
        return [str(x) for x in raw]
    baseline = department_baseline_slot(department)
    if baseline and baseline != slot:
        alt = row.get(baseline)
        if isinstance(alt, list) and alt:
            return [str(x) for x in alt]
    legacy = row.get(LEGACY_TEAM_MEMBER_SLOT)
    if isinstance(legacy, list) and legacy:
        return [str(x) for x in legacy]
    return []


def _infer_slot_from_jwt_roles(roles: list[str]) -> str | None:
    """Manager/supervisor/lead tiers from JWT roles."""
    role_set = {str(r).strip().lower() for r in roles}
    if UserRole.manager.value in role_set:
        return "manager"
    if UserRole.supervisor.value in role_set:
        return "supervisor"
    if UserRole.lead.value in role_set:
        return "lead"
    return None


def _infer_slot_from_job_title(job_title: str | None) -> str | None:
    jt = (job_title or "").lower()
    if "coordination" in jt or "coordinator" in jt:
        return "coordination"
    if "operations" in jt:
        return "operations"
    return None


def infer_matrix_slot_legacy(*, roles: list[str], job_title: str | None, department: str = "maintenance") -> tuple[str, MatrixSlotSource]:
    """Migration/backfill helper — uses department baseline instead of team_member."""
    jwt_slot = _infer_slot_from_jwt_roles(roles)
    if jwt_slot:
        return jwt_slot, "jwt_role"
    title_slot = _infer_slot_from_job_title(job_title)
    if title_slot:
        return title_slot, "job_title_inference"
    baseline = department_baseline_slot(department)
    if baseline:
        return baseline, "department_baseline"
    return UNRESOLVED_MATRIX_SLOT, "unresolved"


def resolve_permission_matrix_slot(user: User, hr: PulseWorkerHR | None) -> tuple[str, MatrixSlotSource]:
    from app.core.matrix_slot_policy import resolve_matrix_slot_for_access

    return resolve_matrix_slot_for_access(user, hr)


def permission_matrix_slot_for_user(user: User, hr: PulseWorkerHR | None) -> str:
    slot, _ = resolve_permission_matrix_slot(user, hr)
    return slot


def matrix_slot_resolution_warnings(
    user: User,
    hr: PulseWorkerHR | None,
    *,
    resolved_slot: str,
    resolved_slot_source: MatrixSlotSource,
) -> list[str]:
    warn: list[str] = []
    explicit = normalize_matrix_slot(getattr(hr, "matrix_slot", None) if hr else None)
    if explicit:
        return warn

    src = resolved_slot_source
    if src == "department_default":
        src = "department_baseline"

    if src == "jwt_role":
        warn.append(f"JWT role tier resolved matrix slot to {resolved_slot!r}.")
    elif src == "job_title_inference":
        warn.append(f"Job title inference matched {resolved_slot!r}.")
    elif src == "department_baseline":
        warn.append(
            f"Matrix slot {resolved_slot!r} from department baseline (set explicit matrix_slot on HR to pin)."
        )
    elif src == "explicit_required_policy":
        warn.append(
            "REQUIRE_EXPLICIT_ELEVATED_SLOTS: authorization unresolved until explicit HR matrix_slot is set."
        )
    elif src in ("unresolved", "fallback_default"):
        warn.append(
            "Authorization unresolved — no department baseline could be applied. Fix HR department or set explicit matrix_slot."
        )
    return warn


def expand_department_role_matrix_baselines(
    matrix: dict[str, dict[str, list[str]]],
) -> dict[str, dict[str, list[str]]]:
    """Copy legacy ``team_member`` permissions into each department's baseline slot when empty."""
    out: dict[str, dict[str, list[str]]] = {}
    for dept, row in matrix.items():
        if dept not in PERMISSION_MATRIX_DEPARTMENTS:
            continue
        new_row = dict(row)
        baseline = DEPARTMENT_BASELINE_SLOTS.get(dept)
        if not baseline:
            out[dept] = new_row
            continue
        if not new_row.get(baseline) and new_row.get(LEGACY_TEAM_MEMBER_SLOT):
            new_row[baseline] = list(new_row[LEGACY_TEAM_MEMBER_SLOT])
        out[dept] = new_row
    return out
