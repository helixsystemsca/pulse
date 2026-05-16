"""Matrix slot policy: unified job title source, resolver/trace consistency, enforcement."""

from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest

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


def test_resolve_effective_job_title_falls_back_to_user() -> None:
    user = _user(job_title="Communications Coordinator")
    hr = _hr(job_title=None)
    assert resolve_effective_job_title(user, hr) == "Communications Coordinator"


def test_user_title_only_resolves_coordination() -> None:
    user = _user(job_title="Communications Coordinator")
    hr = _hr(job_title=None, matrix_slot=None)
    slot, source = resolve_matrix_slot_for_access(user, hr)
    assert slot == "coordination"
    assert source == "job_title_inference"


def test_resolver_and_trace_agree_user_title_only() -> None:
    user = _user(job_title="Communications Coordinator")
    hr = _hr(job_title=None, matrix_slot=None)
    detail = resolve_matrix_slot_detailed(user, hr)
    trace = build_inference_attempt_trace(user, hr)
    assert detail.slot == "coordination"
    assert detail.source == "job_title_inference"
    assert trace == detail.inference_trace
    assert any("✓ Job title keyword matched → 'coordination'" in line for line in trace)
    assert detail.effective_job_title == "Communications Coordinator"
    assert detail.hr_job_title is None
    assert detail.user_job_title == "Communications Coordinator"


def test_communications_worker_department_default_without_titles() -> None:
    user = _user(job_title=None)
    hr = _hr(department="communications", job_title=None, matrix_slot=None)
    slot, source = resolve_matrix_slot_for_access(user, hr)
    assert slot == "coordination"
    assert source == "department_default"


def test_maintenance_worker_department_default_operations() -> None:
    user = _user(job_title=None)
    hr = _hr(department="maintenance", department_slugs=["maintenance"], job_title=None, matrix_slot=None)
    slot, source = resolve_matrix_slot_for_access(user, hr)
    assert slot == "operations"
    assert source == "department_default"


def test_aquatics_department_no_default_falls_back_to_team_member() -> None:
    user = _user(job_title=None)
    hr = _hr(department="aquatics", department_slugs=["aquatics"], job_title=None, matrix_slot=None)
    slot, source = resolve_matrix_slot_for_access(user, hr)
    assert slot == "team_member"
    assert source == "fallback_default"


def test_enforcement_suppresses_coordination_with_truthful_source(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("REQUIRE_EXPLICIT_ELEVATED_SLOTS", "true")
    user = _user(job_title="Communications Coordinator")
    hr = _hr(job_title=None, matrix_slot=None)
    detail = resolve_matrix_slot_detailed(user, hr)
    assert detail.slot == "team_member"
    assert detail.source == "explicit_required_policy"
    assert detail.policy_suppressed is True
    assert detail.suppressed_inferred_slot == "coordination"
    assert any("✓ Job title keyword matched → 'coordination'" in line for line in detail.inference_trace)
    assert any("REQUIRE_EXPLICIT_ELEVATED_SLOTS" in line for line in detail.inference_trace)
    assert build_inference_attempt_trace(user, hr) == detail.inference_trace


def test_enforcement_off_user_title_coordination(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("REQUIRE_EXPLICIT_ELEVATED_SLOTS", raising=False)
    user = _user(job_title="Communications Coordinator")
    hr = _hr(job_title=None, matrix_slot=None)
    slot, source = resolve_matrix_slot_for_access(user, hr)
    assert slot == "coordination"
    assert source == "job_title_inference"
