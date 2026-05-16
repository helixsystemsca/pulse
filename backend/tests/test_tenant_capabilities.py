"""Authoritative tenant_role_assignments → resolve_tenant_capabilities."""

from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tenant_capabilities import resolve_tenant_capabilities
from app.core.tenant_role_assignments import assign_user_department_role
from app.models.domain import Company, User, UserRole


async def _seed_user(db_session: AsyncSession, **kwargs) -> User:
    company_id = str(uuid4())
    db_session.add(Company(id=company_id, name="Test Co", theme={}))
    fid = kwargs.get("feature_allow_extra")
    user = User(
        id=str(uuid4()),
        company_id=company_id,
        email=f"w_{uuid4().hex[:6]}@test.com",
        hashed_password="x",
        roles=kwargs.get("roles") or [UserRole.worker.value],
        operational_role="worker",
        is_active=True,
        is_system_admin=False,
        feature_allow_extra=fid if fid is not None else [],
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest.mark.asyncio
async def test_unassigned_worker_gets_no_matrix_features(db_session: AsyncSession) -> None:
    user = await _seed_user(db_session)
    contract = ["dashboard", "inventory", "comms_publication_builder"]
    merged = {
        "department_role_feature_access": {
            "communications": {
                "coordination": ["comms_publication_builder"],
                "team_member": ["dashboard"],
            },
        },
    }
    caps = await resolve_tenant_capabilities(
        db_session,
        user,
        contract_names=contract,
        merged_settings=merged,
    )
    assert caps.status == "unassigned"
    assert caps.features == []
    assert "comms_publication_builder" not in caps.features


@pytest.mark.asyncio
async def test_assigned_coordination_gets_matrix_cell(db_session: AsyncSession) -> None:
    user = await _seed_user(db_session)
    cid = str(user.company_id)
    await assign_user_department_role(
        db_session,
        company_id=cid,
        user_id=str(user.id),
        department_slug="communications",
        role_key="coordination",
        assigned_by=None,
    )
    await db_session.commit()

    contract = ["dashboard", "comms_publication_builder"]
    merged = {
        "department_role_feature_access": {
            "communications": {
                "coordination": ["comms_publication_builder"],
                "team_member": ["dashboard"],
            },
        },
    }
    caps = await resolve_tenant_capabilities(
        db_session,
        user,
        contract_names=contract,
        merged_settings=merged,
    )
    assert caps.status == "assigned"
    assert caps.department_slug == "communications"
    assert caps.role_key == "coordination"
    assert caps.features == ["comms_publication_builder"]


@pytest.mark.asyncio
async def test_explicit_team_member_role_not_fallback(db_session: AsyncSession) -> None:
    """team_member is a deliberate assignment, not an automatic fallback."""
    user = await _seed_user(db_session)
    cid = str(user.company_id)
    await assign_user_department_role(
        db_session,
        company_id=cid,
        user_id=str(user.id),
        department_slug="aquatics",
        role_key="team_member",
        assigned_by=None,
    )
    await db_session.commit()

    merged = {
        "department_role_feature_access": {
            "aquatics": {
                "team_member": ["schedule"],
                "aquatics_staff": ["schedule", "team_management"],
            },
        },
    }
    caps = await resolve_tenant_capabilities(
        db_session,
        user,
        contract_names=["schedule", "team_management"],
        merged_settings=merged,
    )
    assert caps.role_key == "team_member"
    assert caps.features == ["schedule"]


@pytest.mark.asyncio
async def test_feature_allow_extra_unions_with_matrix(db_session: AsyncSession) -> None:
    user = await _seed_user(db_session, feature_allow_extra=["monitoring"])
    cid = str(user.company_id)
    await assign_user_department_role(
        db_session,
        company_id=cid,
        user_id=str(user.id),
        department_slug="maintenance",
        role_key="team_member",
        assigned_by=None,
    )
    await db_session.commit()

    caps = await resolve_tenant_capabilities(
        db_session,
        user,
        contract_names=["dashboard", "monitoring"],
        merged_settings={"department_role_feature_access": {"maintenance": {"team_member": ["dashboard"]}}},
    )
    assert set(caps.features) == {"dashboard", "monitoring"}


@pytest.mark.asyncio
async def test_company_admin_bypass(db_session: AsyncSession) -> None:
    user = await _seed_user(db_session, roles=[UserRole.company_admin.value])
    caps = await resolve_tenant_capabilities(
        db_session,
        user,
        contract_names=["dashboard"],
        merged_settings={},
    )
    assert caps.status == "admin_bypass"
    assert "dashboard" in caps.features
