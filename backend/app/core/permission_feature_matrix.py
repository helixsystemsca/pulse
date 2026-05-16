"""Team Management `department_role_feature_access`: allowed departments/slots + HR-aware resolution."""

from __future__ import annotations

from typing import Any, Literal

from app.core.features.system_catalog import GLOBAL_SYSTEM_FEATURES
from app.core.user_roles import user_has_any_role
from app.core.workspace_departments import normalize_workspace_department_slug, normalize_workspace_department_slug_list
from app.models.domain import User, UserRole
from app.models.pulse_models import PulseWorkerHR

PERMISSION_MATRIX_DEPARTMENTS: frozenset[str] = frozenset(
    {"maintenance", "communications", "aquatics", "reception", "fitness", "racquets", "admin"}
)
PERMISSION_MATRIX_SLOTS: frozenset[str] = frozenset(
    {"manager", "coordination", "supervisor", "lead", "operations", "team_member"}
)

MatrixSlotSource = Literal[
    "explicit_matrix_slot",
    "jwt_role",
    "job_title_inference",
    "fallback_default",
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


def _infer_slot_from_jwt_roles(roles: list[str]) -> str | None:
    """Manager/supervisor/lead tiers from JWT roles (not worker-tier job-title heuristics)."""
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


def infer_matrix_slot_legacy(*, roles: list[str], job_title: str | None) -> tuple[str, MatrixSlotSource]:
    """
  Legacy inference used when ``matrix_slot`` is unset (migration backfill + runtime fallback).

  Order: JWT admin tiers → job title keywords → team_member default.
  """
    jwt_slot = _infer_slot_from_jwt_roles(roles)
    if jwt_slot:
        return jwt_slot, "jwt_role"
    title_slot = _infer_slot_from_job_title(job_title)
    if title_slot:
        return title_slot, "job_title_inference"
    return "team_member", "fallback_default"


def resolve_permission_matrix_slot(user: User, hr: PulseWorkerHR | None) -> tuple[str, MatrixSlotSource]:
    """
    Authoritative matrix slot for ``department_role_feature_access`` row selection.

    Delegates to ``matrix_slot_policy.resolve_matrix_slot_for_access`` (see module docstring for order).
    """
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
    """Human-readable warnings for access debugger / admin tooling."""
    warn: list[str] = []
    explicit = normalize_matrix_slot(getattr(hr, "matrix_slot", None) if hr else None)
    if explicit:
        return warn

    warn.append("No explicit matrix_slot configured on HR record — using legacy inference.")
    if resolved_slot_source == "jwt_role":
        warn.append(f"JWT role tier resolved matrix slot to {resolved_slot!r}.")
    elif resolved_slot_source == "job_title_inference":
        jt = (hr.job_title if hr else None) or ""
        warn.append(f"Job title inference matched {resolved_slot!r} (job_title={jt!r}).")
    elif resolved_slot_source == "explicit_required_policy":
        warn.append(
            "REQUIRE_EXPLICIT_ELEVATED_SLOTS: team_member enforced until explicit HR matrix_slot "
            "(inference may have succeeded — see matrix_slot_inference_trace)."
        )
    elif resolved_slot_source == "fallback_default":
        warn.append("Fallback team_member used — no explicit slot, JWT tier, or job title keyword match.")
    return warn
