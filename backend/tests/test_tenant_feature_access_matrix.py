"""Tenant feature visibility: role-based default deny."""

from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

from app.models.domain import User, UserRole
from app.models.rbac_models import TenantRole


def _user(roles: list[str], *, tenant_role_id: str | None = None) -> User:
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
    )


def _eff(**kwargs):
    import app.main  # noqa: F401

    from app.core.tenant_feature_access import effective_tenant_feature_names_for_user

    return effective_tenant_feature_names_for_user(**kwargs)


def test_no_tenant_role_default_deny() -> None:
    contract = ["dashboard", "monitoring", "compliance"]
    user = _user([UserRole.worker.value])
    eff = _eff(user=user, contract_names=contract, merged_settings={}, tenant_role=None)
    assert eff == []


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
