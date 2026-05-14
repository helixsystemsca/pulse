"""Unit tests for RBAC resolution (no HTTP)."""

from __future__ import annotations

from uuid import uuid4

import pytest

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
    from app.core.rbac.resolve import effective_rbac_permission_keys

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
async def test_empty_tenant_role_denies() -> None:
    user = _user([UserRole.worker.value], tenant_role_id=str(uuid4()))
    keys = await _keys(
        user=user,
        contract_feature_names=["monitoring"],
        effective_feature_names=[],
    )
    assert keys == []
