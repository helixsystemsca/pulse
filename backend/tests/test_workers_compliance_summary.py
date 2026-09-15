"""Regression: `/api/workers/compliance-summary` must not match `/{user_id}` (invalid UUID → 500)."""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app.models.domain import User
from tests.conftest import auth_headers


@pytest.mark.asyncio
async def test_workers_compliance_summary_is_not_user_id_route(client, seeded_tenant, db_session) -> None:
    manager = (
        await db_session.execute(select(User).where(User.id == seeded_tenant.manager_id))
    ).scalar_one()
    manager.feature_allow_extra = ["team_management"]
    await db_session.flush()

    res = await client.get(
        "/api/workers/compliance-summary",
        headers=auth_headers(seeded_tenant.manager_token),
    )
    assert res.status_code != 500, res.text
    assert "invalid uuid" not in res.text.lower()
    assert res.status_code == 200, res.text
    body = res.json()
    assert "compliance_rate_pct" in body
    assert "worker_count" in body
    assert body["worker_count"] >= 1
    assert body["missed_acknowledgments"] >= 0
