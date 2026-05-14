"""RBAC enforcement: API denial + introspection access."""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth.security import create_access_token
from app.models.domain import User, UserRole


@pytest.mark.asyncio
async def test_monitoring_denied_when_contract_empty(
    client: AsyncClient,
    seeded_tenant,
    db_session: AsyncSession,
) -> None:
    from app.core.company_features import sync_enabled_features

    await sync_enabled_features(db_session, seeded_tenant.company_id, [])
    await db_session.commit()

    r = await client.get(
        f"/api/v1/monitoring/alerts?limit=5",
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
    assert "denied_catalog_keys" in data
