"""Cross-layer RBAC resolution audit."""

from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest

import app.main  # noqa: F401

from app.core.rbac_resolution_audit import debug_resolved_access
from app.models.domain import User, UserRole


def _dummy_async_session():
    class _Dummy:
        pass

    return _Dummy()


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


@pytest.mark.asyncio
async def test_resolved_audit_publication_builder_denied_without_matrix_and_rbac() -> None:
    user = _user([UserRole.worker.value])
    hr = SimpleNamespace(
        department_slugs=["communications"],
        department="communications",
        job_title="",
        matrix_slot="coordination",
    )
    contract = ["comms_publication_builder", "inventory"]
    merged = {
        "department_role_feature_access": {
            "communications": {"coordination": ["inventory"]},
        },
    }
    audit = await debug_resolved_access(
        db=_dummy_async_session(),
        target=user,
        contract_normalized=contract,
        merged_settings=merged,
        hr_row=hr,
        tenant_role=None,
        department_slug="communications",
    )
    pub = next(e for e in audit["feature_resolution_log"] if e["registry_key"] == "comms_publication_builder")
    assert pub["sidebar_visible"] is False
    assert pub["failure_reason"] == "sidebar_hidden"
    assert "comms_publication_builder" in audit["denied_features"]


@pytest.mark.asyncio
async def test_resolved_audit_publication_builder_allowed_when_matrix_and_rbac() -> None:
    user = _user([UserRole.worker.value])
    hr = SimpleNamespace(
        department_slugs=["communications"],
        department="communications",
        job_title="",
        matrix_slot="coordination",
    )
    contract = ["comms_publication_builder"]
    merged = {
        "department_role_feature_access": {
            "communications": {"coordination": ["comms_publication_builder"]},
        },
    }
    audit = await debug_resolved_access(
        db=_dummy_async_session(),
        target=user,
        contract_normalized=contract,
        merged_settings=merged,
        hr_row=hr,
        tenant_role=None,
        department_slug="communications",
    )
    pub = next(e for e in audit["feature_resolution_log"] if e["registry_key"] == "comms_publication_builder")
    assert pub["sidebar_visible"] is True
    assert pub["route_allowed"] is True
    assert pub["render_allowed"] is True
    assert audit["workspace_context"]["department_hub_allowed"] is True
