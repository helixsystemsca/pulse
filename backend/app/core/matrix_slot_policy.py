"""
Matrix slot resolution — single authoritative resolver.

Organizational model:
1. Explicit HR ``matrix_slot``
2. Elevated inference (JWT tier, job title keywords)
3. Department baseline slot (every active department has one)
4. Unresolved (invalid/missing department only — rare)

``team_member`` is a legacy matrix row key, not an operational identity.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Any

from app.core.department_matrix_baselines import (
    UNRESOLVED_MATRIX_SLOT,
    department_baseline_slot,
    operational_matrix_slot_label,
)
from app.core.permission_feature_matrix import (
    MatrixSlotSource,
    _infer_slot_from_job_title,
    _infer_slot_from_jwt_roles,
    normalize_matrix_slot,
    permission_matrix_department_for_user,
)
from app.core.user_roles import user_has_any_role, user_has_facility_tenant_admin_flag, user_has_tenant_full_admin
from app.models.domain import User, UserRole
from app.models.pulse_models import PulseWorkerHR

_log = logging.getLogger("pulse.matrix_slot_policy")

_SLOT_SOURCE_KIND: dict[str, str] = {
    "explicit_matrix_slot": "explicit",
    "jwt_role": "inferred",
    "job_title_inference": "inferred",
    "department_baseline": "baseline",
    "department_default": "baseline",
    "unresolved": "unresolved",
    "fallback_default": "unresolved",
    "explicit_required_policy": "policy",
}

_SOURCE_ANNOTATION: dict[str, str] = {
    "explicit_matrix_slot": "Explicit",
    "jwt_role": "Inferred",
    "job_title_inference": "Inferred",
    "department_baseline": "Department default",
    "department_default": "Department default",
    "unresolved": "Unresolved",
    "fallback_default": "Unresolved",
    "explicit_required_policy": "Policy hold",
}


def require_explicit_elevated_slots() -> bool:
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
    return hr_job_title_raw(hr) or user_job_title_raw(user)


@dataclass
class MatrixSlotResolution:
    slot: str
    source: MatrixSlotSource
    department: str = "maintenance"
    hr_job_title: str | None = None
    user_job_title: str | None = None
    effective_job_title: str | None = None
    inference_trace: list[str] = field(default_factory=list)
    policy_suppressed: bool = False
    suppressed_inferred_slot: str | None = None
    suppressed_inferred_source: MatrixSlotSource | None = None


def _policy_hold(
    *,
    trace: list[str],
    elev_reasons: list[str],
    suppressed_slot: str | None = None,
    suppressed_source: MatrixSlotSource | None = None,
    hr_jt: str | None,
    user_jt: str | None,
    effective_jt: str | None,
) -> MatrixSlotResolution:
    trace.append(
        "✗ REQUIRE_EXPLICIT_ELEVATED_SLOTS: explicit HR matrix_slot required "
        f"(elevated_reasons={elev_reasons})."
    )
    return MatrixSlotResolution(
        slot=UNRESOLVED_MATRIX_SLOT,
        source="explicit_required_policy",
        hr_job_title=hr_jt,
        user_job_title=user_jt,
        effective_job_title=effective_jt,
        inference_trace=trace,
        policy_suppressed=True,
        suppressed_inferred_slot=suppressed_slot,
        suppressed_inferred_source=suppressed_source,
    )


def resolve_matrix_slot_detailed(user: User, hr: PulseWorkerHR | None) -> MatrixSlotResolution:
    hr_jt = hr_job_title_raw(hr)
    user_jt = user_job_title_raw(user)
    effective_jt = resolve_effective_job_title(user, hr)
    dept = permission_matrix_department_for_user(user, hr)
    trace: list[str] = [
        f"Permission-matrix department: {dept!r}",
        f"HR job title: {hr_jt!r}",
        f"User job title: {user_jt!r}",
        f"Effective job title: {effective_jt!r}",
    ]

    explicit = normalize_matrix_slot(getattr(hr, "matrix_slot", None) if hr else None)
    if explicit:
        trace.append(f"✓ Explicit HR matrix_slot → {explicit!r}")
        return MatrixSlotResolution(
            slot=explicit,
            source="explicit_matrix_slot",
            department=dept,
            hr_job_title=hr_jt,
            user_job_title=user_jt,
            effective_job_title=effective_jt,
            inference_trace=trace,
        )

    trace.append("HR matrix_slot unset — resolving elevated inference, then department baseline.")
    policy_on = require_explicit_elevated_slots()

    def _maybe_hold(
        slot: str,
        source: MatrixSlotSource,
        elev_reasons: list[str],
    ) -> MatrixSlotResolution | None:
        if not policy_on:
            return None
        trace.append(f"✗ Policy would block inferred slot {slot!r} ({source}).")
        return _policy_hold(
            trace=trace,
            elev_reasons=elev_reasons,
            suppressed_slot=slot,
            suppressed_source=source,
            hr_jt=hr_jt,
            user_jt=user_jt,
            effective_jt=effective_jt,
        )

    jwt_slot = _infer_slot_from_jwt_roles(list(user.roles or []))
    if jwt_slot:
        trace.append(f"✓ JWT elevated tier → {jwt_slot!r}")
        held = _maybe_hold(jwt_slot, "jwt_role", ["REQUIRE_EXPLICIT_ELEVATED_SLOTS"])
        if held:
            held.department = dept
            return held
        return MatrixSlotResolution(
            slot=jwt_slot,
            source="jwt_role",
            department=dept,
            hr_job_title=hr_jt,
            user_job_title=user_jt,
            effective_job_title=effective_jt,
            inference_trace=trace,
        )
    trace.append("✗ No JWT manager / supervisor / lead tier.")

    title_slot = _infer_slot_from_job_title(effective_jt)
    if title_slot:
        trace.append(f"✓ Job title elevated keyword → {title_slot!r}")
        held = _maybe_hold(title_slot, "job_title_inference", ["REQUIRE_EXPLICIT_ELEVATED_SLOTS"])
        if held:
            held.department = dept
            return held
        return MatrixSlotResolution(
            slot=title_slot,
            source="job_title_inference",
            department=dept,
            hr_job_title=hr_jt,
            user_job_title=user_jt,
            effective_job_title=effective_jt,
            inference_trace=trace,
        )
    trace.append("✗ No coordination / operations keyword in job title.")

    baseline = department_baseline_slot(dept)
    if baseline:
        trace.append(f"✓ Department baseline for {dept!r} → {baseline!r}")
        held = _maybe_hold(baseline, "department_baseline", ["REQUIRE_EXPLICIT_ELEVATED_SLOTS"])
        if held:
            held.department = dept
            return held
        return MatrixSlotResolution(
            slot=baseline,
            source="department_baseline",
            department=dept,
            hr_job_title=hr_jt,
            user_job_title=user_jt,
            effective_job_title=effective_jt,
            inference_trace=trace,
        )

    trace.append(f"✗ No baseline slot configured for department {dept!r} → unresolved.")
    return MatrixSlotResolution(
        slot=UNRESOLVED_MATRIX_SLOT,
        source="unresolved",
        department=dept,
        hr_job_title=hr_jt,
        user_job_title=user_jt,
        effective_job_title=effective_jt,
        inference_trace=trace,
    )


def resolve_matrix_slot_for_access(user: User, hr: PulseWorkerHR | None) -> tuple[str, MatrixSlotSource]:
    r = resolve_matrix_slot_detailed(user, hr)
    return r.slot, r.source


def build_inference_attempt_trace(user: User, hr: PulseWorkerHR | None) -> list[str]:
    return list(resolve_matrix_slot_detailed(user, hr).inference_trace)


def matrix_slot_source_kind(source: MatrixSlotSource | str) -> str:
    return _SLOT_SOURCE_KIND.get(str(source), "inferred")


def matrix_slot_source_annotation(source: MatrixSlotSource | str) -> str:
    return _SOURCE_ANNOTATION.get(str(source), "Inferred")


def format_matrix_slot_display(
    *,
    slot: str,
    source: MatrixSlotSource | str,
    department: str | None = None,
) -> str:
    """Operational label only — source shown separately in admin UI."""
    return operational_matrix_slot_label(slot, department=department)


def matrix_slot_fallback_warning_message(*, resolved_slot: str, source: MatrixSlotSource) -> str | None:
    if source == "explicit_matrix_slot":
        return None
    if source == "explicit_required_policy":
        return (
            "REQUIRE_EXPLICIT_ELEVATED_SLOTS is enabled: set an explicit HR matrix_slot. "
            "See inference trace for the slot that would have applied."
        )
    if source in ("unresolved", "fallback_default") or resolved_slot == UNRESOLVED_MATRIX_SLOT:
        return (
            "Authorization is unresolved — fix HR department or set an explicit matrix_slot on the worker profile."
        )
    if source == "department_baseline":
        return None
    return (
        f"Matrix slot {resolved_slot!r} was inferred ({source}). "
        "Set explicit matrix_slot on HR for a fixed assignment."
    )


def worker_slot_audit_fields(
    user: User,
    hr: PulseWorkerHR | None,
    *,
    department: str,
    tenant_role_slug: str | None = None,
) -> dict[str, Any]:
    detail = resolve_matrix_slot_detailed(user, hr)
    explicit_hr = normalize_matrix_slot(getattr(hr, "matrix_slot", None) if hr else None)
    return {
        "resolved_matrix_slot": detail.slot,
        "matrix_slot_source": detail.source,
        "matrix_slot_source_kind": matrix_slot_source_kind(detail.source),
        "matrix_slot_inferred": detail.source != "explicit_matrix_slot",
        "matrix_slot_operational_label": format_matrix_slot_display(
            slot=detail.slot, source=detail.source, department=detail.department
        ),
        "matrix_slot_source_label": matrix_slot_source_annotation(detail.source),
        "matrix_slot_display": format_matrix_slot_display(
            slot=detail.slot, source=detail.source, department=detail.department
        ),
        "hr_matrix_slot": explicit_hr,
        "hr_job_title": detail.hr_job_title,
        "user_job_title": detail.user_job_title,
        "effective_job_title": detail.effective_job_title,
        "inference_trace": list(detail.inference_trace),
        "policy_suppressed": detail.policy_suppressed,
        "suppressed_inferred_slot": detail.suppressed_inferred_slot,
        "is_unresolved": detail.slot == UNRESOLVED_MATRIX_SLOT
        or detail.source in ("unresolved", "fallback_default"),
    }


def suggest_explicit_matrix_slot_for_department(department: str) -> str | None:
    """Admin bulk-assign: department baseline as explicit HR value."""
    return department_baseline_slot(department)
