"""Tenant feature visibility: role-based default deny."""

from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

from app.models.domain import User, UserRole
from app.models.rbac_models import TenantRole


def _user(
    roles: list[str],
    *,
    tenant_role_id: str | None = None,
    feature_allow_extra: list[str] | None = None,
) -> User:
    return User(
        id=str(uuid4()),
        company_id=str(uuid4()),
        email=f"u_{uuid4().hex[:8]}@example.com",
        hashed_password="x",
        roles=roles,
        operational_role="worker",
        is_active=True,
        is_system_admin=False,
        tenant_role_id=tenant_role_id,
        feature_allow_extra=feature_allow_extra if feature_allow_extra is not None else [],
    )


def _eff(**kwargs):
    import app.main  # noqa: F401

    from app.core.tenant_feature_access import effective_tenant_feature_names_for_user

    return effective_tenant_feature_names_for_user(**kwargs)


def test_no_tenant_role_default_deny() -> None:
    contract = ["dashboard", "monitoring", "compliance"]
    user = _user([UserRole.worker.value])
    eff = _eff(user=user, contract_names=contract, merged_settings={}, tenant_role=None, hr=None)
    assert eff == []


def test_admin_department_manager_resolves_admin_matrix_row() -> None:
    contract = ["dashboard", "inventory"]
    user = _user([UserRole.manager.value], tenant_role_id=None)
    hr = SimpleNamespace(department_slugs=["admin"], department="admin", job_title="Director")
    merged = {
        "department_role_feature_access": {
            "admin": {"manager": ["inventory"]},
            "maintenance": {"manager": ["dashboard"]},
        },
    }
    eff = _eff(user=user, contract_names=contract, merged_settings=merged, tenant_role=None, hr=hr)
    assert eff == ["inventory"]


def test_maintenance_manager_and_admin_manager_can_have_different_modules() -> None:
    contract = ["dashboard", "inventory", "work_requests"]
    matrix = {
        "department_role_feature_access": {
            "maintenance": {"manager": ["dashboard", "work_requests"]},
            "admin": {"manager": ["inventory"]},
        },
    }
    hr_maint = SimpleNamespace(department_slugs=["maintenance"], department="maintenance", job_title="")
    hr_admin = SimpleNamespace(department_slugs=["admin"], department="admin", job_title="")

    user_maint = _user([UserRole.manager.value], tenant_role_id=None)
    eff_maint = _eff(
        user=user_maint, contract_names=contract, merged_settings=matrix, tenant_role=None, hr=hr_maint
    )
    assert set(eff_maint) == {"dashboard", "work_requests"}

    user_admin = _user([UserRole.manager.value], tenant_role_id=None)
    eff_admin = _eff(
        user=user_admin, contract_names=contract, merged_settings=matrix, tenant_role=None, hr=hr_admin
    )
    assert eff_admin == ["inventory"]


def test_sanitize_department_matrix_accepts_admin_rows() -> None:
    from app.core.permission_feature_matrix import sanitize_department_role_feature_access

    raw = {"admin": {"manager": ["dashboard", "invalid_fake_module_xyz"]}}
    out = sanitize_department_role_feature_access(raw)
    assert "admin" in out
    assert "manager" in out["admin"]
    assert "dashboard" in out["admin"]["manager"]
    assert "invalid_fake_module_xyz" not in out["admin"]["manager"]


def test_matrix_resolves_when_tenant_role_overlay_empty() -> None:
    contract = ["dashboard", "inventory"]
    role = TenantRole(
        id=str(uuid4()),
        company_id=str(uuid4()),
        slug="inventory_specialist",
        name="Inventory Specialist",
        feature_keys=[],
    )
    user = _user([UserRole.worker.value], tenant_role_id=role.id)
    merged = {"department_role_feature_access": {"communications": {"coordination": ["dashboard"]}}}
    hr = SimpleNamespace(department_slugs=["communications"], department="communications", job_title="Coordinator")
    eff = _eff(user=user, contract_names=contract, merged_settings=merged, tenant_role=role, hr=hr)
    assert eff == ["dashboard"]


def test_communications_coordinator_matrix_plus_overlay_inventory() -> None:
    contract = ["dashboard", "inventory", "comms_assets"]
    role = TenantRole(
        id=str(uuid4()),
        company_id=str(uuid4()),
        slug="inventory_specialist",
        name="Inventory Specialist",
        feature_keys=["inventory"],
    )
    user = _user([UserRole.worker.value], tenant_role_id=role.id)
    merged = {
        "department_role_feature_access": {
            "communications": {"coordination": ["dashboard", "comms_assets"]},
        },
    }
    hr = SimpleNamespace(department_slugs=["communications"], department="communications", job_title="Coordinator")
    eff = _eff(user=user, contract_names=contract, merged_settings=merged, tenant_role=role, hr=hr)
    assert set(eff) == {"dashboard", "inventory", "comms_assets"}


def test_feature_allow_extra_unions_with_matrix() -> None:
    contract = ["dashboard", "monitoring"]
    user = _user([UserRole.worker.value], feature_allow_extra=["monitoring"])
    merged = {"department_role_feature_access": {"maintenance": {"team_member": ["dashboard"]}}}
    eff = _eff(user=user, contract_names=contract, merged_settings=merged, tenant_role=None, hr=None)
    assert set(eff) == {"dashboard", "monitoring"}


def test_department_matrix_without_tenant_role_respects_coordination_slot() -> None:
    contract = ["dashboard", "comms_assets"]
    user = _user([UserRole.worker.value], tenant_role_id=None)
    hr = SimpleNamespace(department_slugs=["communications"], department="communications", job_title="Coordinator")
    merged = {
        "department_role_feature_access": {
            "communications": {
                "coordination": ["dashboard", "comms_assets"],
            },
        },
    }
    eff = _eff(user=user, contract_names=contract, merged_settings=merged, tenant_role=None, hr=hr)
    assert set(eff) == {"dashboard", "comms_assets"}


def test_no_access_slug_denies_despite_matrix() -> None:
    contract = ["dashboard"]
    role = TenantRole(
        id=str(uuid4()),
        company_id=str(uuid4()),
        slug="no_access",
        name="No access",
        feature_keys=[],
    )
    user = _user([UserRole.worker.value], tenant_role_id=role.id)
    merged = {"department_role_feature_access": {"maintenance": {"team_member": ["dashboard"]}}}
    eff = _eff(user=user, contract_names=contract, merged_settings=merged, tenant_role=role, hr=None)
    assert eff == []


def test_tenant_role_additive_union_with_matrix() -> None:
    contract = ["dashboard", "monitoring", "compliance"]
    role = TenantRole(
        id=str(uuid4()),
        company_id=str(uuid4()),
        slug="custom",
        name="Custom",
        feature_keys=["dashboard"],
    )
    user = _user([UserRole.worker.value], tenant_role_id=role.id)
    merged = {"department_role_feature_access": {"maintenance": {"team_member": ["monitoring"]}}}
    eff = _eff(user=user, contract_names=contract, merged_settings=merged, tenant_role=role, hr=None)
    assert set(eff) == {"dashboard", "monitoring"}


def test_legacy_role_feature_access_unions_with_overlay_when_matrix_unset() -> None:
    contract = ["dashboard", "inventory"]
    role = TenantRole(
        id=str(uuid4()),
        company_id=str(uuid4()),
        slug="inventory_specialist",
        name="Inventory Specialist",
        feature_keys=["inventory"],
    )
    user = _user([UserRole.worker.value], tenant_role_id=role.id)
    merged = {"role_feature_access": {"worker": ["dashboard"]}}
    eff = _eff(user=user, contract_names=contract, merged_settings=merged, tenant_role=role, hr=None)
    assert set(eff) == {"dashboard", "inventory"}


def test_tenant_role_feature_keys_intersect_contract() -> None:
    contract = ["dashboard", "monitoring", "compliance", "procedures"]
    role = TenantRole(
        id=str(uuid4()),
        company_id=str(uuid4()),
        slug="ops",
        name="Ops",
        feature_keys=["dashboard", "logs_inspections", "monitoring"],
    )
    user = _user([UserRole.worker.value], tenant_role_id=role.id)
    eff = _eff(user=user, contract_names=contract, merged_settings={}, tenant_role=role)
    assert "dashboard" in eff
    assert "monitoring" in eff
    assert "logs_inspections" in eff
    assert "procedures" not in eff


def test_company_admin_gets_full_contract_canonicalized() -> None:
    contract = ["compliance", "dashboard"]
    user = _user([UserRole.company_admin.value])
    eff = _eff(user=user, contract_names=contract, merged_settings={})
    assert "dashboard" in eff
    assert "logs_inspections" in eff


def test_company_admin_empty_contract_gets_full_catalog() -> None:
    user = _user([UserRole.company_admin.value])
    from app.core.tenant_feature_access import tenant_full_admin_canonical_features

    eff = tenant_full_admin_canonical_features([])
    assert "dashboard" in eff
    assert "monitoring" in eff
    assert "work_requests" in eff
