"""Matrix slot policy: elevated detection and explicit-slot enforcement flag."""

from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.core.matrix_slot_policy import (
    build_inference_attempt_trace,
    detect_likely_elevated_worker,
    recommend_explicit_matrix_slot,
    require_explicit_elevated_slots,
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


def test_detect_coordinator_by_job_title() -> None:
    user = _user(job_title="Communications Coordinator")
    hr = SimpleNamespace(department="communications", department_slugs=["communications"], job_title="Communications Coordinator", matrix_slot=None)
    elevated, reasons = detect_likely_elevated_worker(user, hr)
    assert elevated is True
    assert "job_title_elevated_keyword" in reasons


def test_recommend_coordination_for_coordinator_title() -> None:
    user = _user(job_title="Coordinator")
    hr = SimpleNamespace(department="communications", department_slugs=["communications"], job_title="Coordinator", matrix_slot=None)
    assert recommend_explicit_matrix_slot(user, hr) == "coordination"


def test_inference_trace_fallback() -> None:
    user = _user(job_title="")
    hr = SimpleNamespace(department="communications", job_title="", matrix_slot=None)
    trace = build_inference_attempt_trace(user, hr)
    assert any("fallback team_member" in line for line in trace)


def test_require_explicit_flag_off_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("REQUIRE_EXPLICIT_ELEVATED_SLOTS", raising=False)
    assert require_explicit_elevated_slots() is False


def test_require_explicit_blocks_inference_for_elevated(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("REQUIRE_EXPLICIT_ELEVATED_SLOTS", "true")
    user = _user(job_title="Communications Coordinator")
    hr = SimpleNamespace(department="communications", job_title="Communications Coordinator", matrix_slot=None)
    slot, source = resolve_matrix_slot_for_access(user, hr)
    assert slot == "team_member"
    assert source == "fallback_default"
