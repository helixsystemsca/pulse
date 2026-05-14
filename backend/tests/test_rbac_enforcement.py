"""RBAC enforcement: API denial + introspection access."""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth.security import create_access_token
from app.models.domain import User, UserRole
from tests.tenant_role_helpers import assign_worker_no_access_role


@pytest.mark.asyncio
async def test_monitoring_denied_when_worker_matrix_empty(
    client: AsyncClient,
    seeded_tenant,
    db_session: AsyncSession,
) -> None:
    """Company contract includes monitoring; worker role grants none → RBAC denies."""
    from app.core.company_features import sync_enabled_features
    from app.core.features.system_catalog import GLOBAL_SYSTEM_FEATURES
    from app.models.pulse_models import PulseWorkersSettings

    await sync_enabled_features(db_session, seeded_tenant.company_id, list(GLOBAL_SYSTEM_FEATURES))
    worker = await db_session.get(User, seeded_tenant.worker_id)
    assert worker is not None
    await assign_worker_no_access_role(
        db_session,
        company_id=seeded_tenant.company_id,
        user=worker,
        contract_names=list(GLOBAL_SYSTEM_FEATURES),
    )
    db_session.add(
        PulseWorkersSettings(
            company_id=seeded_tenant.company_id,
            settings={"role_feature_access": {"worker": []}},
        )
    )
    await db_session.flush()

    r = await client.get(
        "/api/v1/monitoring/alerts?limit=5",
        headers={"Authorization": f"Bearer {seeded_tenant.worker_token}"},
    )
    assert r.status_code == 403, r.text
    body = r.json()
    assert body.get("detail", {}).get("code") == "rbac_permission_required"


@pytest.mark.asyncio
async def test_monitoring_allowed_with_default_contract(
    client: AsyncClient,
    seeded_tenant,
) -> None:
    r = await client.get(
        "/api/v1/monitoring/alerts?limit=5",
        headers={"Authorization": f"Bearer {seeded_tenant.worker_token}"},
    )
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_rbac_introspection_requires_company_admin(
    client: AsyncClient,
    seeded_tenant,
    db_session: AsyncSession,
) -> None:
    r = await client.get(
        "/api/v1/rbac/introspection",
        headers={"Authorization": f"Bearer {seeded_tenant.worker_token}"},
    )
    assert r.status_code == 403, r.text

    admin = await db_session.get(User, seeded_tenant.manager_id)
    assert admin is not None
    admin.roles = [UserRole.company_admin.value]
    await db_session.flush()

    admin_token = create_access_token(
        subject=seeded_tenant.manager_id,
        extra_claims={"company_id": seeded_tenant.company_id, "role": UserRole.company_admin.value, "tv": 0},
    )
    r2 = await client.get(
        "/api/v1/rbac/introspection",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r2.status_code == 200, r2.text
    data = r2.json()
    assert data["user_id"] == seeded_tenant.manager_id
    assert "effective_rbac_keys" in data
    assert "*" in data["effective_rbac_keys"]
    assert "denied_catalog_keys" in data
