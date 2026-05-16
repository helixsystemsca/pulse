"""
Matrix slot resolution policy: inference visibility, elevated-worker detection, optional enforcement.

Resolution order (legacy compatibility — explicit HR assignment is always preferred):

1. ``PulseWorkerHR.matrix_slot`` when set (explicit; never overridden)
2. JWT manager / supervisor / lead tiers
3. Job title keywords (coordination, operations, …)
4. ``team_member`` fallback (baseline frontline default)

Inference is legacy compatibility only. Fallback is baseline worker behavior, not coordinator access.
"""

from __future__ import annotations

import logging
import os
from typing import Any

from app.core.permission_feature_matrix import (
    MatrixSlotSource,
    _infer_slot_from_job_title,
    _infer_slot_from_jwt_roles,
    infer_matrix_slot_legacy,
    normalize_matrix_slot,
)
from app.core.user_roles import user_has_any_role, user_has_facility_tenant_admin_flag, user_has_tenant_full_admin
from app.models.domain import User, UserRole
from app.models.pulse_models import PulseWorkerHR

_log = logging.getLogger("pulse.matrix_slot_policy")

_ELEVATED_TITLE_KEYWORDS: frozenset[str] = frozenset(
    {
        "coordinator",
        "coordination",
        "supervisor",
        "manager",
        "director",
        "lead",
        "head of",
        "administrator",
        "admin",
    }
)

_SLOT_SOURCE_KIND: dict[MatrixSlotSource, str] = {
    "explicit_matrix_slot": "explicit",
    "jwt_role": "inferred",
    "job_title_inference": "inferred",
    "fallback_default": "fallback",
}


def require_explicit_elevated_slots() -> bool:
    """When true, likely-elevated workers cannot receive inferred/fallback slots (team_member only until explicit)."""
    return os.getenv("REQUIRE_EXPLICIT_ELEVATED_SLOTS", "").lower() in ("1", "true", "yes")


def matrix_slot_source_kind(source: MatrixSlotSource | str) -> str:
    return _SLOT_SOURCE_KIND.get(source, "inferred")  # type: ignore[arg-type]


def format_matrix_slot_display(*, slot: str, source: MatrixSlotSource | str) -> str:
    """Human label e.g. ``Coordination (Explicit)``."""
    labels = {
        "manager": "Manager",
        "coordination": "Coordination",
        "supervisor": "Supervisor",
        "lead": "Lead",
        "operations": "Operations",
        "team_member": "Team Member",
    }
    slot_label = labels.get(slot, slot.replace("_", " ").title())
    kind = matrix_slot_source_kind(source)
    suffix = {"explicit": "Explicit", "inferred": "Inferred", "fallback": "Fallback"}.get(kind, "Inferred")
    return f"{slot_label} ({suffix})"


def detect_likely_elevated_worker(
    user: User,
    hr: PulseWorkerHR | None,
    *,
    tenant_role_slug: str | None = None,
) -> tuple[bool, list[str]]:
    """
    Heuristic: worker probably should not rely on ``team_member`` fallback.

    For admin warnings only — does not grant access.
    """
    reasons: list[str] = []
    if user.is_system_admin or user_has_any_role(user, UserRole.system_admin):
        reasons.append("system_admin")
    if user_has_tenant_full_admin(user) or user_has_facility_tenant_admin_flag(user):
        reasons.append("tenant_full_admin")
    if user_has_any_role(user, UserRole.company_admin):
        reasons.append("company_admin_role")
    if user_has_any_role(user, UserRole.manager):
        reasons.append("jwt_manager")
    if user_has_any_role(user, UserRole.supervisor):
        reasons.append("jwt_supervisor")
    if user_has_any_role(user, UserRole.lead):
        reasons.append("jwt_lead")

    jt = ((hr.job_title if hr else None) or user.job_title or "").lower()
    if jt and any(k in jt for k in _ELEVATED_TITLE_KEYWORDS):
        reasons.append("job_title_elevated_keyword")

    dept_slugs = getattr(hr, "department_slugs", None) if hr else None
    if isinstance(dept_slugs, list) and len(dept_slugs) > 1:
        reasons.append("multiple_department_slugs")

    extras = getattr(user, "feature_allow_extra", None) or []
    if isinstance(extras, list) and len(extras) > 0:
        reasons.append("feature_allow_extra")

    if tenant_role_slug and tenant_role_slug not in ("no_access", "worker", "team_member"):
        reasons.append(f"tenant_role:{tenant_role_slug}")

    return (len(reasons) > 0, reasons)


def recommend_explicit_matrix_slot(
    user: User,
    hr: PulseWorkerHR | None,
    *,
    elevated_reasons: list[str] | None = None,
) -> str | None:
    """Suggested HR ``matrix_slot`` for admins cleaning up inferred access."""
    jt = ((hr.job_title if hr else None) or user.job_title or "").lower()
    if "coordinator" in jt or "coordination" in jt:
        return "coordination"
    if "operations" in jt:
        return "operations"
    if user_has_any_role(user, UserRole.manager) or "manager" in jt:
        return "manager"
    if user_has_any_role(user, UserRole.supervisor) or "supervisor" in jt:
        return "supervisor"
    if user_has_any_role(user, UserRole.lead) or "lead" in jt:
        return "lead"
    if elevated_reasons:
        dept = (hr.department if hr else None) or ""
        if "communications" in str(dept).lower():
            return "coordination"
        return "coordination"
    return None


def build_inference_attempt_trace(user: User, hr: PulseWorkerHR | None) -> list[str]:
    """Ordered explanation of matrix slot resolution attempts (for debug UI)."""
    explicit = normalize_matrix_slot(getattr(hr, "matrix_slot", None) if hr else None)
    if explicit:
        return [f"HR matrix_slot is explicitly set to {explicit!r} — inference chain skipped."]

    trace: list[str] = [
        "HR matrix_slot is empty or auto — running legacy inference chain.",
        f"JWT roles checked: {list(user.roles or [])}",
    ]
    jwt_slot = _infer_slot_from_jwt_roles(list(user.roles or []))
    if jwt_slot:
        trace.append(f"✓ JWT role tier matched → {jwt_slot!r}")
        return trace
    trace.append("✗ No JWT manager / supervisor / lead tier match.")

    jt = (hr.job_title if hr else None) or user.job_title or ""
    trace.append(f"Job title checked: {jt!r}")
    title_slot = _infer_slot_from_job_title(jt)
    if title_slot:
        trace.append(f"✓ Job title keyword matched → {title_slot!r}")
        return trace
    trace.append("✗ No coordination / operations keyword in job title.")

    trace.append("✗ All inference checks failed → fallback team_member (baseline worker row).")
    return trace


def matrix_slot_fallback_warning_message(*, resolved_slot: str, source: MatrixSlotSource) -> str | None:
    if source == "explicit_matrix_slot":
        return None
    if source == "fallback_default" and resolved_slot == "team_member":
        return (
            "WARNING: Authorization is using fallback team_member because no explicit matrix_slot exists. "
            "Coordinators and other elevated workers must have an explicit slot assigned in HR."
        )
    if source != "explicit_matrix_slot":
        return (
            f"Authorization matrix slot {resolved_slot!r} was inferred ({source}), not set explicitly on HR. "
            "Assign matrix_slot on the worker profile for deterministic access."
        )
    return None


def resolve_matrix_slot_for_access(user: User, hr: PulseWorkerHR | None) -> tuple[str, MatrixSlotSource]:
    """
    Production matrix slot resolution with optional elevated-worker policy.

    When ``REQUIRE_EXPLICIT_ELEVATED_SLOTS`` is enabled, likely-elevated workers without an
    explicit HR slot always resolve to ``team_member`` (no JWT/title inference).
    """
    explicit = normalize_matrix_slot(getattr(hr, "matrix_slot", None) if hr else None)
    if explicit:
        return explicit, "explicit_matrix_slot"

    if require_explicit_elevated_slots():
        elevated, reasons = detect_likely_elevated_worker(user, hr)
        if elevated:
            _log.warning(
                "REQUIRE_EXPLICIT_ELEVATED_SLOTS: denying inference user_id=%s reasons=%s → team_member",
                user.id,
                reasons,
            )
            return "team_member", "fallback_default"

    return infer_matrix_slot_legacy(roles=list(user.roles or []), job_title=hr.job_title if hr else None)


def log_inferred_elevated_worker(
    *,
    user: User,
    hr: PulseWorkerHR | None,
    department: str,
    resolved_slot: str,
    source: MatrixSlotSource,
    elevated_reasons: list[str],
) -> None:
    """Operational telemetry when fallback/inference affects a likely-elevated worker."""
    if source == "explicit_matrix_slot":
        return
    elevated, reasons = detect_likely_elevated_worker(user, hr)
    if not elevated:
        return
    if source == "fallback_default" or (elevated_reasons or reasons):
        _log.warning(
            "inferred_access_elevated_worker user_id=%s company_id=%s department=%s job_title=%r "
            "resolved_slot=%s source=%s elevated_reasons=%s recommended=%s",
            user.id,
            user.company_id,
            department,
            (hr.job_title if hr else None) or user.job_title,
            resolved_slot,
            source,
            reasons or elevated_reasons,
            recommend_explicit_matrix_slot(user, hr, elevated_reasons=reasons),
        )


def worker_slot_audit_fields(
    user: User,
    hr: PulseWorkerHR | None,
    *,
    department: str,
    tenant_role_slug: str | None = None,
) -> dict[str, Any]:
    """Roster / admin UI fields derived from policy helpers."""
    slot, source = resolve_matrix_slot_for_access(user, hr)
    elevated, elev_reasons = detect_likely_elevated_worker(user, hr, tenant_role_slug=tenant_role_slug)
    recommended = recommend_explicit_matrix_slot(user, hr, elevated_reasons=elev_reasons)
    explicit_hr = normalize_matrix_slot(getattr(hr, "matrix_slot", None) if hr else None)
    return {
        "resolved_matrix_slot": slot,
        "matrix_slot_source": source,
        "matrix_slot_source_kind": matrix_slot_source_kind(source),
        "matrix_slot_inferred": source != "explicit_matrix_slot",
        "matrix_slot_display": format_matrix_slot_display(slot=slot, source=source),
        "likely_elevated": elevated,
        "likely_elevated_reasons": elev_reasons,
        "recommended_matrix_slot": recommended,
        "hr_matrix_slot": explicit_hr,
        "inference_trace": build_inference_attempt_trace(user, hr),
    }
