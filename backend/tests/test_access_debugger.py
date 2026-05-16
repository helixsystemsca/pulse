"""Production-path access-resolution debugger snapshots."""

from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest

import app.main  # noqa: F401

from app.core.access_debugger import compute_access_resolution_debug
from app.models.domain import User, UserRole
from app.models.rbac_models import TenantRole


def _dummy_async_session():
    """`effective_rbac_permission_keys` does not touch the DB; signature requires a session."""

    class _Dummy:
        pass

    return _Dummy()


def _tenant_user(**kwargs):
    fid = kwargs.get("feature_allow_extra")
    pid = kwargs.get("permission_deny")
    return User(
        id=str(uuid4()),
        company_id=str(uuid4()),
        email=f"w_{uuid4().hex[:8]}@example.com",
        hashed_password="x",
        roles=kwargs.get("roles") or [UserRole.worker.value],
        operational_role="worker",
        is_active=True,
        is_system_admin=False,
        tenant_role_id=kwargs.get("tenant_role_id"),
        feature_allow_extra=fid if fid is not None else [],
        permission_deny=pid if pid is not None else [],
    )


@pytest.mark.asyncio
async def test_matrix_only_user_source_attribution() -> None:
    contract = ["dashboard", "inventory", "monitoring"]
    merged = {"department_role_feature_access": {"communications": {"coordination": ["inventory"]}}}
    hr = SimpleNamespace(
        department_slugs=["communications"],
        department="communications",
        job_title="Coordinator",
    )
    user = _tenant_user()
    dbg = await compute_access_resolution_debug(
        db=_dummy_async_session(),
        target=user,
        contract_normalized=contract,
        merged_settings=merged,
        hr_row=hr,
        tenant_role=None,
    )
    assert dbg.resolution_kind == "matrix_primary"
    assert dbg.effective_enabled_features == ["inventory"]
    assert dbg.source_attribution.get("inventory", "").startswith("matrix:communications+coordination")


@pytest.mark.asyncio
async def test_contract_filters_matrix_cell_features_denied_by_contract() -> None:
    contract = ["inventory"]
    merged = {"department_role_feature_access": {"communications": {"coordination": ["dashboard", "inventory"]}}}
    hr = SimpleNamespace(
        department_slugs=["communications"],
        department="communications",
        job_title="Coordinator",
    )
    user = _tenant_user()
    dbg = await compute_access_resolution_debug(
        db=_dummy_async_session(),
        target=user,
        contract_normalized=contract,
        merged_settings=merged,
        hr_row=hr,
        tenant_role=None,
    )
    assert "dashboard" in dbg.denied_by_contract
    assert dbg.effective_enabled_features == ["inventory"]


@pytest.mark.asyncio
async def test_matrix_plus_feature_allow_extra() -> None:
    contract = ["dashboard", "inventory", "monitoring"]
    merged = {"department_role_feature_access": {"communications": {"coordination": ["inventory"]}}}
    hr = SimpleNamespace(
        department_slugs=["communications"],
        department="communications",
        job_title="Coordinator",
    )
    user = _tenant_user(feature_allow_extra=["monitoring"])
    dbg = await compute_access_resolution_debug(
        db=_dummy_async_session(),
        target=user,
        contract_normalized=contract,
        merged_settings=merged,
        hr_row=hr,
        tenant_role=None,
    )
    assert set(dbg.effective_enabled_features) == {"inventory", "monitoring"}
    assert dbg.source_attribution["inventory"].startswith("matrix:")
    assert dbg.source_attribution["monitoring"] == "feature_allow_extra"


@pytest.mark.asyncio
async def test_no_access_user_clears_modules() -> None:
    contract = ["dashboard"]
    role = TenantRole(
        id=str(uuid4()),
        company_id=str(uuid4()),
        slug="no_access",
        name="No access",
        feature_keys=["dashboard"],
    )
    user = _tenant_user(tenant_role_id=role.id)
    merged = {"department_role_feature_access": {"maintenance": {"team_member": ["dashboard"]}}}
    dbg = await compute_access_resolution_debug(
        db=_dummy_async_session(),
        target=user,
        contract_normalized=contract,
        merged_settings=merged,
        tenant_role=role,
        hr_row=None,
    )
    assert dbg.resolution_kind == "no_access_overlay"
    assert dbg.effective_enabled_features == []


@pytest.mark.asyncio
async def test_missing_hr_defaults_matrix_department_to_maintenance() -> None:
    contract = ["dashboard"]
    merged = {"department_role_feature_access": {"maintenance": {"team_member": ["dashboard"]}}}
    user = _tenant_user()
    dbg = await compute_access_resolution_debug(
        db=_dummy_async_session(),
        target=user,
        contract_normalized=contract,
        merged_settings=merged,
        hr_row=None,
        tenant_role=None,
    )
    assert dbg.resolved_department == "maintenance"


@pytest.mark.asyncio
async def test_coordination_job_title_inference_warning() -> None:
    contract = ["dashboard"]
    merged = {"department_role_feature_access": {"communications": {"coordination": ["dashboard"]}}}
    hr = SimpleNamespace(
        department_slugs=["communications"],
        department="communications",
        job_title="Pool Coordinator",
    )
    user = _tenant_user()
    dbg = await compute_access_resolution_debug(
        db=_dummy_async_session(),
        target=user,
        contract_normalized=contract,
        merged_settings=merged,
        hr_row=hr,
        tenant_role=None,
    )
    assert dbg.resolved_slot == "coordination"
    assert dbg.resolved_slot_source == "job_title_inference"
    assert any("job title inference matched" in w.lower() for w in dbg.warnings)


@pytest.mark.asyncio
async def test_wrong_slot_communications_worker_without_coordination_title() -> None:
    """Worker on communications department but generic job title ⇒ team_member matrix slot."""
    contract = ["dashboard"]
    merged = {
        "department_role_feature_access": {
            "communications": {
                "coordination": ["monitoring"],
                "team_member": ["dashboard"],
            },
        },
    }
    hr = SimpleNamespace(
        department_slugs=["communications"],
        department="communications",
        job_title="Lifeguard",
    )
    user = _tenant_user()
    dbg = await compute_access_resolution_debug(
        db=_dummy_async_session(),
        target=user,
        contract_normalized=contract,
        merged_settings=merged,
        hr_row=hr,
        tenant_role=None,
    )
    assert dbg.resolved_slot == "team_member"
    assert dbg.effective_enabled_features == ["dashboard"]


@pytest.mark.asyncio
async def test_overlay_assigned_but_matrix_primary_warnings() -> None:
    """Tenant role with feature_keys should warn that overlay keys do not widen enabled_features."""
    contract = ["dashboard", "inventory", "monitoring", "projects"]
    role = TenantRole(
        id=str(uuid4()),
        company_id=str(uuid4()),
        slug="legacy_full_access",
        name="Legacy",
        feature_keys=["dashboard", "monitoring"],
    )
    user = _tenant_user(tenant_role_id=role.id)
    merged = {"department_role_feature_access": {"communications": {"coordination": ["inventory"]}}}
    hr = SimpleNamespace(
        department_slugs=["communications"],
        department="communications",
        job_title="Coordinator",
    )
    dbg = await compute_access_resolution_debug(
        db=_dummy_async_session(),
        target=user,
        contract_normalized=contract,
        merged_settings=merged,
        hr_row=hr,
        tenant_role=role,
    )
    assert dbg.effective_enabled_features == ["inventory"]
    assert set(dbg.overlay_features) <= {"dashboard", "monitoring"}
    assert any("tenant_role_id assigned" in w for w in dbg.warnings)


@pytest.mark.asyncio
async def test_permission_deny_surfaces_without_subtracting_sidebar() -> None:
    user = _tenant_user(permission_deny=["schedule"])
    dbg = await compute_access_resolution_debug(
        db=_dummy_async_session(),
        target=user,
        contract_normalized=["dashboard"],
        merged_settings={},
        hr_row=None,
        tenant_role=None,
    )
    assert dbg.feature_deny_extra == ["schedule"]
    assert any("permission_deny" in w for w in dbg.warnings)


@pytest.mark.asyncio
async def test_nav_ready_user_rbac_derived_from_effective_features() -> None:
    """Bridge grants permission keys aligned with resolved modules — nav may hide without RBAC even if modules match."""
    contract = ["inventory", "team_management"]
    merged = {"department_role_feature_access": {"maintenance": {"team_member": ["inventory"]}}}
    user = _tenant_user(feature_allow_extra=["team_management"])
    dbg = await compute_access_resolution_debug(
        db=_dummy_async_session(),
        target=user,
        contract_normalized=contract,
        merged_settings=merged,
        hr_row=None,
        tenant_role=None,
    )
    assert set(dbg.effective_enabled_features) == {"inventory", "team_management"}
    assert "*" not in dbg.rbac_permission_keys
    tm_ok = any(k.startswith("team_management") for k in dbg.rbac_permission_keys)
    assert tm_ok, "RBAC bridge should expose team_management.* when feature is effectively enabled"


@pytest.mark.asyncio
async def test_legacy_fallback_attribution_when_matrix_unset() -> None:
    contract = ["dashboard", "inventory"]
    merged = {"role_feature_access": {"worker": ["dashboard"]}}
    user = _tenant_user()
    dbg = await compute_access_resolution_debug(
        db=_dummy_async_session(),
        target=user,
        contract_normalized=contract,
        merged_settings=merged,
        hr_row=None,
        tenant_role=None,
    )
    assert dbg.resolution_kind == "legacy_role_feature_access_fallback"
    assert dbg.legacy_bucket == "worker"
    assert dbg.effective_enabled_features == ["dashboard"]
    assert dbg.source_attribution["dashboard"].startswith("legacy:")


def _find_missing(dbg, key: str):
    for m in dbg.missing_feature_explanations:
        if m.feature_key == key:
            return m
    return None


@pytest.mark.asyncio
async def test_missing_monitoring_disabled_in_matrix() -> None:
    contract = ["dashboard", "inventory", "monitoring"]
    merged = {"department_role_feature_access": {"communications": {"coordination": ["inventory"]}}}
    hr = SimpleNamespace(
        department_slugs=["communications"],
        department="communications",
        job_title="Coordinator",
    )
    user = _tenant_user()
    dbg = await compute_access_resolution_debug(
        db=_dummy_async_session(),
        target=user,
        contract_normalized=contract,
        merged_settings=merged,
        hr_row=hr,
        tenant_role=None,
    )
    mon = _find_missing(dbg, "monitoring")
    assert mon is not None
    assert mon.missing_reason == "disabled_in_matrix"
    assert "matrix" in mon.denied_by
    assert "contract" in mon.expected_from


@pytest.mark.asyncio
async def test_missing_schedule_filtered_by_contract() -> None:
    contract = ["dashboard"]
    merged = {"department_role_feature_access": {"maintenance": {"team_member": ["dashboard", "schedule"]}}}
    user = _tenant_user()
    dbg = await compute_access_resolution_debug(
        db=_dummy_async_session(),
        target=user,
        contract_normalized=contract,
        merged_settings=merged,
        hr_row=None,
        tenant_role=None,
    )
    sched = _find_missing(dbg, "schedule")
    assert sched is not None
    assert sched.missing_reason == "filtered_by_contract"


@pytest.mark.asyncio
async def test_missing_hr_department_defaults_maintenance_in_details() -> None:
    contract = ["dashboard", "monitoring"]
    merged = {
        "department_role_feature_access": {
            "maintenance": {"team_member": ["dashboard"]},
            "communications": {"coordination": ["monitoring"]},
        },
    }
    user = _tenant_user()
    dbg = await compute_access_resolution_debug(
        db=_dummy_async_session(),
        target=user,
        contract_normalized=contract,
        merged_settings=merged,
        hr_row=None,
        tenant_role=None,
    )
    mon = _find_missing(dbg, "monitoring")
    assert mon is not None
    assert mon.missing_reason in ("disabled_in_matrix", "slot_mismatch")
    assert any("PulseWorkerHR" in d for d in mon.resolution_details)


@pytest.mark.asyncio
async def test_slot_mismatch_monitoring_in_coordination_slot_only() -> None:
    contract = ["dashboard", "monitoring"]
    merged = {
        "department_role_feature_access": {
            "communications": {
                "coordination": ["monitoring"],
                "team_member": ["dashboard"],
            },
        },
    }
    hr = SimpleNamespace(
        department_slugs=["communications"],
        department="communications",
        job_title="Lifeguard",
    )
    user = _tenant_user()
    dbg = await compute_access_resolution_debug(
        db=_dummy_async_session(),
        target=user,
        contract_normalized=contract,
        merged_settings=merged,
        hr_row=hr,
        tenant_role=None,
    )
    mon = _find_missing(dbg, "monitoring")
    assert mon is not None
    assert mon.missing_reason == "slot_mismatch"


@pytest.mark.asyncio
async def test_overlay_ignored_missing_dashboard() -> None:
    contract = ["dashboard", "inventory"]
    role = TenantRole(
        id=str(uuid4()),
        company_id=str(uuid4()),
        slug="custom",
        name="Custom",
        feature_keys=["dashboard"],
    )
    user = _tenant_user(tenant_role_id=role.id)
    merged = {"department_role_feature_access": {"communications": {"coordination": ["inventory"]}}}
    hr = SimpleNamespace(
        department_slugs=["communications"],
        department="communications",
        job_title="Coordinator",
    )
    dbg = await compute_access_resolution_debug(
        db=_dummy_async_session(),
        target=user,
        contract_normalized=contract,
        merged_settings=merged,
        hr_row=hr,
        tenant_role=role,
    )
    dash = _find_missing(dbg, "dashboard")
    assert dash is not None
    assert dash.missing_reason == "overlay_ignored_under_matrix_primary"


@pytest.mark.asyncio
async def test_no_access_explicit_deny_missing() -> None:
    contract = ["dashboard"]
    role = TenantRole(
        id=str(uuid4()),
        company_id=str(uuid4()),
        slug="no_access",
        name="No access",
        feature_keys=[],
    )
    user = _tenant_user(tenant_role_id=role.id)
    merged = {"department_role_feature_access": {"maintenance": {"team_member": ["dashboard"]}}}
    dbg = await compute_access_resolution_debug(
        db=_dummy_async_session(),
        target=user,
        contract_normalized=contract,
        merged_settings=merged,
        tenant_role=role,
        hr_row=None,
    )
    dash = _find_missing(dbg, "dashboard")
    assert dash is not None
    assert dash.missing_reason == "explicit_deny"


@pytest.mark.asyncio
async def test_feature_allow_extra_absent_for_monitoring() -> None:
    contract = ["dashboard", "inventory", "monitoring"]
    merged = {"department_role_feature_access": {"communications": {"coordination": ["inventory"]}}}
    hr = SimpleNamespace(
        department_slugs=["communications"],
        department="communications",
        job_title="Coordinator",
    )
    user = _tenant_user(feature_allow_extra=[])
    dbg = await compute_access_resolution_debug(
        db=_dummy_async_session(),
        target=user,
        contract_normalized=contract,
        merged_settings=merged,
        hr_row=hr,
        tenant_role=None,
    )
    mon = _find_missing(dbg, "monitoring")
    assert mon is not None
    assert mon.missing_reason == "disabled_in_matrix"


@pytest.mark.asyncio
async def test_candidate_universe_includes_contract_keys() -> None:
    contract = ["dashboard"]
    user = _tenant_user()
    dbg = await compute_access_resolution_debug(
        db=_dummy_async_session(),
        target=user,
        contract_normalized=contract,
        merged_settings={},
        hr_row=None,
        tenant_role=None,
    )
    assert "dashboard" in dbg.candidate_feature_keys
    assert len(dbg.missing_feature_explanations) >= 1
