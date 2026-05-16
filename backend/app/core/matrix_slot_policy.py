"""
Matrix slot resolution policy: inference visibility, elevated-worker detection, optional enforcement.

Resolution order (legacy compatibility — explicit HR assignment is always preferred):

1. ``PulseWorkerHR.matrix_slot`` when set (explicit; never overridden)
2. JWT manager / supervisor / lead tiers (on ``user.roles``)
3. Job title keywords on **effective job title** (HR, then User fallback)
4. ``team_member`` fallback (baseline frontline default)

Optional: ``REQUIRE_EXPLICIT_ELEVATED_SLOTS`` forces ``team_member`` for likely-elevated workers
without explicit HR slot (source ``explicit_required_policy``, not inference failure).
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Any

from app.core.permission_feature_matrix import (
    MatrixSlotSource,
    _infer_slot_from_job_title,
    _infer_slot_from_jwt_roles,
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

_SLOT_SOURCE_KIND: dict[str, str] = {
    "explicit_matrix_slot": "explicit",
    "jwt_role": "inferred",
    "job_title_inference": "inferred",
    "fallback_default": "fallback",
    "explicit_required_policy": "policy",
}


def require_explicit_elevated_slots() -> bool:
    """When true, likely-elevated workers cannot receive inferred slots without explicit HR matrix_slot."""
    return os.getenv("REQUIRE_EXPLICIT_ELEVATED_SLOTS", "").lower() in ("1", "true", "yes")


def _normalize_job_title(raw: object | None) -> str | None:
    if raw is None:
        return None
    s = " ".join(str(raw).split())
    return s if s else None


def hr_job_title_raw(hr: PulseWorkerHR | None) -> str | None:
    return _normalize_job_title(getattr(hr, "job_title", None) if hr else None)


def user_job_title_raw(user: User) -> str | None:
    return _normalize_job_title(getattr(user, "job_title", None))


def resolve_effective_job_title(user: User, hr: PulseWorkerHR | None) -> str | None:
    """
    Canonical job title for matrix slot inference, elevated detection, and debug.

    1. ``PulseWorkerHR.job_title`` when present
    2. ``User.job_title`` fallback
    """
    return hr_job_title_raw(hr) or user_job_title_raw(user)


@dataclass
class MatrixSlotResolution:
    """Authoritative matrix slot resolution + trace from a single code path."""

    slot: str
    source: MatrixSlotSource
    hr_job_title: str | None = None
    user_job_title: str | None = None
    effective_job_title: str | None = None
    inference_trace: list[str] = field(default_factory=list)
    policy_suppressed: bool = False
    suppressed_inferred_slot: str | None = None
    suppressed_inferred_source: MatrixSlotSource | None = None


def resolve_matrix_slot_detailed(user: User, hr: PulseWorkerHR | None) -> MatrixSlotResolution:
    """
    Single resolver used for authorization and debug traces.

    ``build_inference_attempt_trace`` and ``resolve_matrix_slot_for_access`` both delegate here.
    """
    hr_jt = hr_job_title_raw(hr)
    user_jt = user_job_title_raw(user)
    effective_jt = resolve_effective_job_title(user, hr)
    trace: list[str] = [
        f"HR job title: {hr_jt!r}",
        f"User job title: {user_jt!r}",
        f"Effective job title used for authorization: {effective_jt!r}",
    ]

    explicit = normalize_matrix_slot(getattr(hr, "matrix_slot", None) if hr else None)
    if explicit:
        trace.append(f"HR matrix_slot is explicitly set to {explicit!r} — inference chain skipped.")
        return MatrixSlotResolution(
            slot=explicit,
            source="explicit_matrix_slot",
            hr_job_title=hr_jt,
            user_job_title=user_jt,
            effective_job_title=effective_jt,
            inference_trace=trace,
        )

    trace.append("HR matrix_slot is empty or auto — running legacy inference chain.")
    trace.append(f"JWT roles checked: {list(user.roles or [])}")

    policy_on = require_explicit_elevated_slots()
    elevated, elev_reasons = detect_likely_elevated_worker(user, hr)

    def _maybe_suppress(
        inferred_slot: str,
        inferred_source: MatrixSlotSource,
    ) -> MatrixSlotResolution | None:
        if not policy_on or not elevated:
            return None
        trace.append(
            f"✗ REQUIRE_EXPLICIT_ELEVATED_SLOTS: would have used {inferred_slot!r} ({inferred_source}) "
            f"but policy requires explicit HR matrix_slot (elevated_reasons={elev_reasons})."
        )
        _log.warning(
            "REQUIRE_EXPLICIT_ELEVATED_SLOTS: suppressing inferred slot user_id=%s "
            "inferred=%s source=%s reasons=%s → team_member",
            user.id,
            inferred_slot,
            inferred_source,
            elev_reasons,
        )
        return MatrixSlotResolution(
            slot="team_member",
            source="explicit_required_policy",
            hr_job_title=hr_jt,
            user_job_title=user_jt,
            effective_job_title=effective_jt,
            inference_trace=trace,
            policy_suppressed=True,
            suppressed_inferred_slot=inferred_slot,
            suppressed_inferred_source=inferred_source,
        )

    jwt_slot = _infer_slot_from_jwt_roles(list(user.roles or []))
    if jwt_slot:
        trace.append(f"✓ JWT role tier matched → {jwt_slot!r}")
        suppressed = _maybe_suppress(jwt_slot, "jwt_role")
        if suppressed:
            return suppressed
        return MatrixSlotResolution(
            slot=jwt_slot,
            source="jwt_role",
            hr_job_title=hr_jt,
            user_job_title=user_jt,
            effective_job_title=effective_jt,
            inference_trace=trace,
        )
    trace.append("✗ No JWT manager / supervisor / lead tier match.")

    title_slot = _infer_slot_from_job_title(effective_jt)
    if title_slot:
        trace.append(f"✓ Job title keyword matched → {title_slot!r}")
        suppressed = _maybe_suppress(title_slot, "job_title_inference")
        if suppressed:
            return suppressed
        return MatrixSlotResolution(
            slot=title_slot,
            source="job_title_inference",
            hr_job_title=hr_jt,
            user_job_title=user_jt,
            effective_job_title=effective_jt,
            inference_trace=trace,
        )
    trace.append("✗ No coordination / operations keyword in effective job title.")

    if policy_on and elevated:
        trace.append(
            f"✗ REQUIRE_EXPLICIT_ELEVATED_SLOTS: no inference match; elevated worker held at "
            f"team_member until explicit matrix_slot is set (elevated_reasons={elev_reasons})."
        )
        return MatrixSlotResolution(
            slot="team_member",
            source="explicit_required_policy",
            hr_job_title=hr_jt,
            user_job_title=user_jt,
            effective_job_title=effective_jt,
            inference_trace=trace,
            policy_suppressed=True,
        )

    trace.append("✗ All inference checks failed → fallback team_member (baseline worker row).")
    return MatrixSlotResolution(
        slot="team_member",
        source="fallback_default",
        hr_job_title=hr_jt,
        user_job_title=user_jt,
        effective_job_title=effective_jt,
        inference_trace=trace,
    )


def resolve_matrix_slot_for_access(user: User, hr: PulseWorkerHR | None) -> tuple[str, MatrixSlotSource]:
    """Production matrix slot resolution (authorization)."""
    r = resolve_matrix_slot_detailed(user, hr)
    return r.slot, r.source


def build_inference_attempt_trace(user: User, hr: PulseWorkerHR | None) -> list[str]:
    """Debug trace from the same resolver path as authorization."""
    return list(resolve_matrix_slot_detailed(user, hr).inference_trace)


def matrix_slot_source_kind(source: MatrixSlotSource | str) -> str:
    return _SLOT_SOURCE_KIND.get(str(source), "inferred")


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
    suffix = {
        "explicit": "Explicit",
        "inferred": "Inferred",
        "fallback": "Fallback",
        "policy": "Policy enforced",
    }.get(kind, "Inferred")
    return f"{slot_label} ({suffix})"


def detect_likely_elevated_worker(
    user: User,
    hr: PulseWorkerHR | None,
    *,
    tenant_role_slug: str | None = None,
) -> tuple[bool, list[str]]:
    """Heuristic for admin warnings only — does not grant access."""
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

    jt = (resolve_effective_job_title(user, hr) or "").lower()
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
    jt = (resolve_effective_job_title(user, hr) or "").lower()
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


def matrix_slot_fallback_warning_message(*, resolved_slot: str, source: MatrixSlotSource) -> str | None:
    if source == "explicit_matrix_slot":
        return None
    if source == "explicit_required_policy":
        return (
            "REQUIRE_EXPLICIT_ELEVATED_SLOTS is enabled: authorization uses team_member until an explicit "
            "matrix_slot is set on HR. See inference trace for the slot that would have applied."
        )
    if source == "fallback_default" and resolved_slot == "team_member":
        return (
            "WARNING: Authorization is using fallback team_member because no explicit matrix_slot exists "
            "and job title / JWT inference did not match a higher slot."
        )
    if source != "explicit_matrix_slot":
        return (
            f"Authorization matrix slot {resolved_slot!r} was inferred ({source}), not set explicitly on HR. "
            "Assign matrix_slot on the worker profile for deterministic access."
        )
    return None


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
    if source in ("fallback_default", "explicit_required_policy") or (elevated_reasons or reasons):
        _log.warning(
            "inferred_access_elevated_worker user_id=%s company_id=%s department=%s effective_job_title=%r "
            "resolved_slot=%s source=%s elevated_reasons=%s recommended=%s",
            user.id,
            user.company_id,
            department,
            resolve_effective_job_title(user, hr),
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
    detail = resolve_matrix_slot_detailed(user, hr)
    elevated, elev_reasons = detect_likely_elevated_worker(user, hr, tenant_role_slug=tenant_role_slug)
    recommended = recommend_explicit_matrix_slot(user, hr, elevated_reasons=elev_reasons)
    explicit_hr = normalize_matrix_slot(getattr(hr, "matrix_slot", None) if hr else None)
    return {
        "resolved_matrix_slot": detail.slot,
        "matrix_slot_source": detail.source,
        "matrix_slot_source_kind": matrix_slot_source_kind(detail.source),
        "matrix_slot_inferred": detail.source != "explicit_matrix_slot",
        "matrix_slot_display": format_matrix_slot_display(slot=detail.slot, source=detail.source),
        "likely_elevated": elevated,
        "likely_elevated_reasons": elev_reasons,
        "recommended_matrix_slot": recommended,
        "hr_matrix_slot": explicit_hr,
        "hr_job_title": detail.hr_job_title,
        "user_job_title": detail.user_job_title,
        "effective_job_title": detail.effective_job_title,
        "inference_trace": list(detail.inference_trace),
        "policy_suppressed": detail.policy_suppressed,
        "suppressed_inferred_slot": detail.suppressed_inferred_slot,
    }
