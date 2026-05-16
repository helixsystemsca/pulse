"""Matrix slot policy: department baselines, unresolved state, unified resolver."""

from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.core.department_matrix_baselines import UNRESOLVED_MATRIX_SLOT
from app.core.matrix_slot_policy import (
    build_inference_attempt_trace,
    resolve_effective_job_title,
    resolve_matrix_slot_detailed,
    resolve_matrix_slot_for_access,
)
from app.models.domain import User, UserRole


def _user(**kwargs) -> User:
    return User(
        id=str(uuid4()),
        company_id=str(uuid4()),
        email="c@test.com",
        hashed_password="x",
        roles=kwargs.get("roles") or [UserRole.worker.value],
        operational_role="worker",
        is_active=True,
        is_system_admin=False,
        job_title=kwargs.get("job_title"),
        feature_allow_extra=kwargs.get("feature_allow_extra") or [],
    )


def _hr(**kwargs) -> SimpleNamespace:
    return SimpleNamespace(
        department=kwargs.get("department", "communications"),
        department_slugs=kwargs.get("department_slugs", ["communications"]),
        job_title=kwargs.get("job_title"),
        matrix_slot=kwargs.get("matrix_slot"),
    )


def test_resolve_effective_job_title_prefers_hr() -> None:
    user = _user(job_title="User Title")
    hr = _hr(job_title="HR Title")
    assert resolve_effective_job_title(user, hr) == "HR Title"


def test_communications_worker_gets_coordination_baseline() -> None:
    user = _user(job_title=None)
    hr = _hr(department="communications", job_title=None, matrix_slot=None)
    slot, source = resolve_matrix_slot_for_access(user, hr)
    assert slot == "coordination"
    assert source == "department_baseline"


def test_maintenance_worker_gets_operations_baseline() -> None:
    user = _user(job_title=None)
    hr = _hr(department="maintenance", department_slugs=["maintenance"], job_title=None, matrix_slot=None)
    slot, source = resolve_matrix_slot_for_access(user, hr)
    assert slot == "operations"
    assert source == "department_baseline"


def test_aquatics_worker_gets_aquatics_staff_baseline() -> None:
    user = _user(job_title=None)
    hr = _hr(department="aquatics", department_slugs=["aquatics"], job_title=None, matrix_slot=None)
    slot, source = resolve_matrix_slot_for_access(user, hr)
    assert slot == "aquatics_staff"
    assert source == "department_baseline"


def test_user_title_coordination_before_baseline() -> None:
    user = _user(job_title="Communications Coordinator")
    hr = _hr(job_title=None, matrix_slot=None)
    slot, source = resolve_matrix_slot_for_access(user, hr)
    assert slot == "coordination"
    assert source == "job_title_inference"


def test_jwt_manager_before_baseline() -> None:
    user = _user(roles=[UserRole.manager.value])
    hr = _hr(department="maintenance", matrix_slot=None)
    slot, source = resolve_matrix_slot_for_access(user, hr)
    assert slot == "manager"
    assert source == "jwt_role"


def test_policy_hold_returns_unresolved(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("REQUIRE_EXPLICIT_ELEVATED_SLOTS", "true")
    user = _user(job_title="Communications Coordinator")
    hr = _hr(job_title=None, matrix_slot=None)
    detail = resolve_matrix_slot_detailed(user, hr)
    assert detail.slot == UNRESOLVED_MATRIX_SLOT
    assert detail.source == "explicit_required_policy"
    assert detail.policy_suppressed is True
    assert detail.suppressed_inferred_slot == "coordination"


def test_resolver_and_trace_agree() -> None:
    user = _user(job_title=None)
    hr = _hr(department="maintenance", department_slugs=["maintenance"], matrix_slot=None)
    detail = resolve_matrix_slot_detailed(user, hr)
    assert detail.inference_trace == build_inference_attempt_trace(user, hr)
    assert any("Department baseline" in line for line in detail.inference_trace)
