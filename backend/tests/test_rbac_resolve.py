"""Unit tests for RBAC resolution (no HTTP)."""

from __future__ import annotations

from uuid import uuid4

import pytest

from app.core.rbac.resolve import effective_rbac_permission_keys
from app.models.domain import User, UserRole


def _user(roles: list[str], **kwargs) -> User:
    return User(
        id=str(uuid4()),
        company_id=str(uuid4()),
        email=f"u_{uuid4().hex[:8]}@example.com",
        hashed_password="x",
        roles=roles,
        operational_role="worker",
        is_active=True,
        is_system_admin=False,
        **kwargs,
    )


async def _keys(**kwargs):
    class _Db:
        async def execute(self, *_a, **_k):
            class _R:
                def all(self):
                    return []

            return _R()

    return await effective_rbac_permission_keys(_Db(), kwargs.pop("user"), **kwargs)


@pytest.mark.asyncio
async def test_company_admin_gets_star() -> None:
    user = _user([UserRole.company_admin.value])
    keys = await _keys(
        user=user,
        contract_feature_names=[],
        effective_feature_names=[],
    )
    assert keys == ["*"]


@pytest.mark.asyncio
async def test_unassigned_user_bridges_contract() -> None:
    user = _user([UserRole.worker.value])
    keys = await _keys(
        user=user,
        contract_feature_names=["monitoring", "work_requests"],
        effective_feature_names=[],
    )
    assert "monitoring.view" in keys
    assert "work_requests.view" in keys


@pytest.mark.asyncio
async def test_tenant_role_grants_union_enabled_features_bridge() -> None:
    """DB grants and bridged matrix/overlay keys merge when ``tenant_role_id`` is set."""

    class _Db:
        async def execute(self, *_a, **_k):
            class _R:
                def all(self):
                    return [("inventory.manage",)]

            return _R()

    user = _user([UserRole.worker.value], tenant_role_id=str(uuid4()))
    keys = await effective_rbac_permission_keys(
        _Db(),
        user,
        contract_feature_names=["inventory", "dashboard"],
        effective_feature_names=["dashboard"],
    )
    assert "inventory.manage" in keys
    assert any(k.endswith(".view") and k.startswith("dashboard") for k in keys)


@pytest.mark.asyncio
async def test_empty_tenant_role_denies() -> None:
    """Uses a random tenant_role_id; mock DB returns no grants (no real FK)."""
    user = _user([UserRole.worker.value], tenant_role_id=str(uuid4()))
    keys = await _keys(
        user=user,
        contract_feature_names=["monitoring"],
        effective_feature_names=[],
    )
    assert keys == []
