"""Authentication: login JWT and protected routes."""

from __future__ import annotations

import re
import uuid
from contextlib import asynccontextmanager

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import AuditLog, LoginEvent, User


@asynccontextmanager
async def _pulse_app_style_role(db_session: AsyncSession):
    """
    Temporary NOBYPASSRLS role with pulse_app-like grants.

    Table-owner pytest connections bypass RLS; SET ROLE is required to simulate
    Render DATABASE_URL=pulse_app with FORCE RLS.
    """
    role = "pulse_auth_" + uuid.uuid4().hex[:10]
    assert re.fullmatch(r"pulse_auth_[0-9a-f]+", role)
    await db_session.execute(text(f"CREATE ROLE {role} NOLOGIN NOBYPASSRLS NOSUPERUSER"))
    try:
        await db_session.execute(text(f"GRANT USAGE ON SCHEMA public TO {role}"))
        await db_session.execute(
            text(f"GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO {role}")
        )
        await db_session.execute(
            text(f"GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {role}")
        )
        await db_session.execute(
            text(f"GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO {role}")
        )
        await db_session.execute(text(f"SET ROLE {role}"))
        try:
            yield role
        finally:
            await db_session.execute(text("RESET ROLE"))
    finally:
        await db_session.execute(text("RESET ROLE"))
        await db_session.execute(
            text(f"REVOKE ALL ON ALL TABLES IN SCHEMA public FROM {role}")
        )
        await db_session.execute(
            text(f"REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM {role}")
        )
        await db_session.execute(
            text(f"REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM {role}")
        )
        await db_session.execute(text(f"REVOKE ALL ON SCHEMA public FROM {role}"))
        await db_session.execute(text(f"DROP ROLE IF EXISTS {role}"))


@pytest.mark.asyncio
async def test_login_returns_jwt(client, seeded_tenant) -> None:
    r = await client.post(
        "/api/v1/auth/login",
        json={"email": seeded_tenant.worker_email, "password": seeded_tenant.password},
    )
    assert r.status_code == 200, f"PIPELINE: auth — {r.text}"
    data = r.json()
    assert "access_token" in data
    assert data.get("token_type") == "bearer"
    assert len(data["access_token"]) > 20


@pytest.mark.asyncio
async def test_protected_route_rejects_without_token(client) -> None:
    r = await client.get("/api/work-requests")
    assert r.status_code == 401, f"PIPELINE: auth — expected 401, got {r.status_code} {r.text}"


@pytest.mark.asyncio
async def test_protected_route_accepts_valid_token(client, seeded_tenant) -> None:
    r = await client.get(
        "/api/work-requests",
        headers={"Authorization": f"Bearer {seeded_tenant.worker_token}"},
    )
    assert r.status_code == 200, f"PIPELINE: auth — {r.status_code} {r.text}"
    body = r.json()
    assert "items" in body
    assert "total" in body


@pytest.mark.asyncio
async def test_login_works_as_nobyprlsrls_role_with_force_rls(
    client, db_session: AsyncSession, seeded_tenant
) -> None:
    """
    Production incident: pulse_app + FORCE RLS hid users (empty GUCs) and login
    returned 500 internal_server_error. Auth bootstrap must set system GUCs,
    then tenant GUCs so lockout / audit / login_events writes succeed.
    """
    email = seeded_tenant.worker_email
    async with _pulse_app_style_role(db_session):
        hidden = (
            await db_session.execute(
                text("SELECT count(*) FROM users WHERE lower(email) = :e"),
                {"e": email.lower()},
            )
        ).scalar()
        assert int(hidden or 0) == 0, "users must be hidden until auth bootstrap GUCs"

        unknown = await client.post(
            "/api/v1/auth/login",
            json={"email": f"missing_{uuid.uuid4().hex[:8]}@example.com", "password": "wrongpass"},
        )
        assert unknown.status_code == 401, unknown.text
        assert unknown.json().get("detail") != "internal_server_error"

        bad = await client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "wrong-password-xx"},
        )
        assert bad.status_code == 401, bad.text
        assert bad.json().get("detail") != "internal_server_error"

        ok = await client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": seeded_tenant.password},
        )
        assert ok.status_code == 200, ok.text
        token = ok.json()["access_token"]
        assert token

        me = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert me.status_code == 200, me.text
        assert me.json()["email"].lower() == email.lower()

    db_session.expire_all()
    user = await db_session.get(User, seeded_tenant.worker_id)
    assert user is not None
    assert user.last_login is not None
    assert int(user.failed_login_attempts or 0) == 0

    events = (
        await db_session.execute(
            select(func.count()).select_from(LoginEvent).where(LoginEvent.user_id == user.id)
        )
    ).scalar_one()
    assert int(events or 0) >= 1

    audits = (
        await db_session.execute(
            select(func.count())
            .select_from(AuditLog)
            .where(AuditLog.action == "auth.login", AuditLog.actor_user_id == user.id)
        )
    ).scalar_one()
    assert int(audits or 0) >= 1
