"""Canonical access snapshot resolver."""

from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest

import app.main  # noqa: F401

from app.core.access_snapshot import resolve_access_snapshot
from app.models.domain import User, UserRole


def _dummy_db():
    class _Dummy:
        pass

    return _Dummy()


def _user(**kwargs) -> User:
    return User(
        id=str(uuid4()),
        company_id=str(uuid4()),
        email=f"w_{uuid4().hex[:6]}@test.com",
        hashed_password="x",
        roles=kwargs.get("roles") or [UserRole.worker.value],
        operational_role="worker",
        is_active=True,
        is_system_admin=False,
    )


@pytest.mark.asyncio
async def test_explicit_coordination_slot_grants_matrix_features() -> None:
    user = _user()
    hr = SimpleNamespace(
        department_slugs=["communications"],
        department="communications",
        job_title="",
        matrix_slot="coordination",
    )
    contract = ["comms_publication_builder", "inventory"]
    merged = {
        "department_role_feature_access": {
            "communications": {
                "coordination": ["comms_publication_builder"],
                "team_member": ["inventory"],
            },
        },
    }
    snap = await resolve_access_snapshot(
        _dummy_db(),
        user,
        contract_names=contract,
        merged_settings=merged,
        hr=hr,
    )
    assert snap.matrix_slot == "coordination"
    assert snap.audit is not None
    assert snap.audit.matrix_slot_source == "explicit_matrix_slot"
    assert snap.audit.matrix_slot_inferred is False
    assert "comms_publication_builder" in snap.features
    assert "inventory" not in snap.features


@pytest.mark.asyncio
async def test_department_baseline_when_slot_unset() -> None:
    user = _user()
    hr = SimpleNamespace(
        department_slugs=["communications"],
        department="communications",
        job_title="",
        matrix_slot=None,
    )
    contract = ["inventory", "comms_publication_builder"]
    merged = {
        "department_role_feature_access": {
            "communications": {
                "coordination": ["comms_publication_builder"],
                "team_member": ["inventory"],
            },
        },
    }
    snap = await resolve_access_snapshot(
        _dummy_db(),
        user,
        contract_names=contract,
        merged_settings=merged,
        hr=hr,
    )
    assert snap.matrix_slot == "coordination"
    assert snap.audit is not None
    assert snap.audit.matrix_slot_source == "department_baseline"
    assert snap.audit.matrix_slot_inferred is True
    assert snap.features == ["comms_publication_builder"]
