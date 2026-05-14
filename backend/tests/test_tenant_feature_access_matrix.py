"""Regression: department permission matrix must not grant the full contract when a dept row is missing."""

from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

from app.models.domain import User, UserRole


def _user(roles: list[str]) -> User:
    return User(
        id=str(uuid4()),
        company_id=str(uuid4()),
        email=f"u_{uuid4().hex[:8]}@pytest.test",
        hashed_password="x",
        roles=roles,
        operational_role="worker",
        is_active=True,
        is_system_admin=False,
    )


def _eff(**kwargs):
    """Import after app graph is loaded to avoid circular import during collection."""
    import app.main  # noqa: F401

    from app.core.tenant_feature_access import effective_tenant_feature_names_for_user

    return effective_tenant_feature_names_for_user(**kwargs)


def test_drfa_enabled_missing_department_row_default_deny_not_full_contract() -> None:
    """
    If `department_role_feature_access` is populated but the user's department has no entry,
    they must get **no** modules — not legacy `role_feature_access` (which often expands to the full contract).
    """
    contract = ["dashboard", "monitoring", "compliance", "procedures", "work_requests"]
    merged = {
        "department_role_feature_access": {
            # Only maintenance configured — communications user must not inherit full contract
            "maintenance": {"team_member": ["dashboard"]},
        },
        "role_feature_access": {"worker": None},
    }
    user = _user([UserRole.worker.value])
    hr = SimpleNamespace(department_slugs=["communications"], department=None, job_title=None)

    eff = _eff(
        user=user, contract_names=contract, merged_settings=merged, hr=hr
    )
    assert eff == [], f"expected no features, got {eff!r}"


def test_drfa_enabled_explicit_empty_slot_stays_empty() -> None:
    contract = ["dashboard", "monitoring"]
    merged = {
        "department_role_feature_access": {
            "communications": {"coordination": []},
        },
    }
    user = _user([UserRole.worker.value])
    hr = SimpleNamespace(department_slugs=["communications"], department=None, job_title="Communications Coordinator")

    eff = _eff(
        user=user, contract_names=contract, merged_settings=merged, hr=hr
    )
    assert eff == []


def test_drfa_disabled_uses_role_feature_access_bucket() -> None:
    contract = ["a", "b"]
    merged = {
        "role_feature_access": {"worker": ["a"]},
    }
    user = _user([UserRole.worker.value])
    eff = _eff(
        user=user, contract_names=contract, merged_settings=merged, hr=None
    )
    assert eff == ["a"]
