"""Explicit PulseWorkerHR.matrix_slot vs legacy inference for permission matrix rows."""

from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.core.permission_feature_matrix import (
    infer_matrix_slot_legacy,
    normalize_matrix_slot,
    resolve_permission_matrix_slot,
)
from app.models.domain import User, UserRole


def _user(roles: list[str]) -> User:
    return User(
        id=str(uuid4()),
        company_id=str(uuid4()),
        email="w@test.com",
        hashed_password="x",
        roles=roles,
        operational_role="worker",
        is_active=True,
        is_system_admin=False,
    )


def _hr(*, job_title: str | None = None, matrix_slot: str | None = None) -> SimpleNamespace:
    return SimpleNamespace(
        job_title=job_title,
        matrix_slot=matrix_slot,
        department="communications",
        department_slugs=["communications"],
    )


def test_normalize_matrix_slot() -> None:
    assert normalize_matrix_slot("coordination") == "coordination"
    assert normalize_matrix_slot(" Team Member ") == "team_member"
    assert normalize_matrix_slot("invalid") is None
    assert normalize_matrix_slot("") is None


def test_explicit_matrix_slot_overrides_job_title_inference() -> None:
    user = _user([UserRole.worker.value])
    hr = _hr(job_title="Pool Coordinator", matrix_slot="team_member")
    slot, src = resolve_permission_matrix_slot(user, hr)
    assert slot == "team_member"
    assert src == "explicit_matrix_slot"


def test_explicit_coordination_resolves_coordination_row() -> None:
    user = _user([UserRole.worker.value])
    hr = _hr(job_title=None, matrix_slot="coordination")
    slot, src = resolve_permission_matrix_slot(user, hr)
    assert slot == "coordination"
    assert src == "explicit_matrix_slot"


def test_missing_matrix_slot_falls_back_to_job_title() -> None:
    user = _user([UserRole.worker.value])
    hr = _hr(job_title="Communications Coordinator", matrix_slot=None)
    slot, src = resolve_permission_matrix_slot(user, hr)
    assert slot == "coordination"
    assert src == "job_title_inference"


def test_missing_everything_uses_department_baseline() -> None:
    user = _user([UserRole.worker.value])
    hr = _hr(job_title=None, matrix_slot=None)
    slot, src = resolve_permission_matrix_slot(user, hr)
    assert slot == "coordination"
    assert src == "department_baseline"


def test_jwt_manager_tier_without_explicit_slot() -> None:
    user = _user([UserRole.manager.value])
    hr = _hr(job_title="Coordinator", matrix_slot=None)
    slot, src = resolve_permission_matrix_slot(user, hr)
    assert slot == "manager"
    assert src == "jwt_role"


def test_legacy_inference_helper_matches_resolve_for_worker() -> None:
    roles = [UserRole.worker.value]
    slot_l, src_l = infer_matrix_slot_legacy(roles=roles, job_title="Lifeguard", department="communications")
    user = _user(roles)
    hr = _hr(job_title="Lifeguard", matrix_slot=None)
    slot_r, src_r = resolve_permission_matrix_slot(user, hr)
    assert slot_l == slot_r
    assert src_l == src_r


@pytest.mark.asyncio
async def test_debugger_reports_resolved_slot_source_explicit() -> None:
    import app.main  # noqa: F401

    from app.core.access_debugger import compute_access_resolution_debug

    user = _user([UserRole.worker.value])
    hr = _hr(job_title=None, matrix_slot="coordination")
    dbg = await compute_access_resolution_debug(
        db=object(),
        target=user,
        contract_normalized=["inventory"],
        merged_settings={
            "department_role_feature_access": {
                "communications": {"coordination": ["inventory"], "team_member": ["dashboard"]},
            },
        },
        hr_row=hr,
        tenant_role=None,
    )
    assert dbg.resolved_slot == "coordination"
    assert dbg.resolved_slot_source == "explicit_matrix_slot"
    assert dbg.hr_matrix_slot == "coordination"
    assert dbg.effective_enabled_features == ["inventory"]


@pytest.mark.asyncio
async def test_debugger_reports_department_baseline_source() -> None:
    import app.main  # noqa: F401

    from app.core.access_debugger import compute_access_resolution_debug

    user = _user([UserRole.worker.value])
    hr = _hr(job_title=None, matrix_slot=None)
    dbg = await compute_access_resolution_debug(
        db=object(),
        target=user,
        contract_normalized=["dashboard", "inventory"],
        merged_settings={
            "department_role_feature_access": {
                "communications": {
                    "coordination": ["inventory"],
                    "team_member": ["dashboard"],
                },
            },
        },
        hr_row=hr,
        tenant_role=None,
    )
    assert dbg.resolved_slot == "coordination"
    assert dbg.resolved_slot_source == "department_baseline"
    assert dbg.effective_enabled_features == ["inventory"]
