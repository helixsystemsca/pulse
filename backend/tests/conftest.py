"""
Test harness: auto-provisioned PostgreSQL (Docker if TEST_DATABASE_URL unset), httpx ASGI client,
transactional isolation per test, seeded tenant + IoT graph.

No manual migration step: `provision_test_database` runs `alembic upgrade head` once per session.
"""

from __future__ import annotations

import os
import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import AsyncIterator
from unittest.mock import patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

# Env before any app import (pydantic loads .env; process env wins over .env file).
os.environ.setdefault("SECRET_KEY", "pytest-secret-key-at-least-32-characters-long!!")
os.environ.setdefault("REQUIRE_HTTPS", "false")
os.environ.setdefault("ENVIRONMENT", "development")


@dataclass
class TenantSeed:
    company_id: str
    worker_id: str
    manager_id: str
    worker_email: str
    manager_email: str
    password: str
    worker_token: str
    manager_token: str
    facility_id: str
    system_id: str
    sensor_ok_id: str
    sensor_warn_id: str
    sensor_crit_id: str
    gateway_id: str
    gateway_secret: str


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture(scope="session")
def test_database():
    from tests.db_lifecycle import TestDbUnavailable, provision_test_database

    try:
        info = provision_test_database()
    except TestDbUnavailable as e:
        pytest.exit(str(e), returncode=1)
    from app.core.config import get_settings

    get_settings.cache_clear()
    yield info
    info.teardown()
    get_settings.cache_clear()


@pytest.fixture(scope="session")
def app(test_database):
    from app.main import app as fastapi_app

    return fastapi_app


class _TestAsyncSessionLocal:
    """Async sessionmaker stand-in: yields the pytest session without closing it."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    def __call__(self) -> "_TestAsyncSessionLocal":
        return self

    async def __aenter__(self) -> AsyncSession:
        return self._session

    async def __aexit__(self, *args: object) -> None:
        return None


@asynccontextmanager
async def _bind_feature_gate_session(session: AsyncSession) -> AsyncIterator[None]:
    """FeatureGateMiddleware uses AsyncSessionLocal, not get_db — share the test transaction."""
    from app.core.features.cache import clear_all

    maker = _TestAsyncSessionLocal(session)
    with patch("app.middleware.feature_gate.AsyncSessionLocal", maker):
        yield
    clear_all()


@pytest_asyncio.fixture
async def db_session(test_database, app):
    """
    One AsyncSession bound to a connection-level transaction rolled back after each test.

    Routes that call ``commit()`` only advance nested transactions (savepoints) so the outer
    rollback discards all changes from the test.
    """
    from app.core.database import engine, get_db

    async with engine.connect() as conn:
        trans = await conn.begin()
        session = AsyncSession(
            bind=conn,
            expire_on_commit=False,
            autoflush=False,
            join_transaction_mode="create_savepoint",
        )

        async def override_get_db():
            yield session

        app.dependency_overrides[get_db] = override_get_db
        async with _bind_feature_gate_session(session):
            try:
                yield session
            finally:
                app.dependency_overrides.pop(get_db, None)
                await session.close()
                await trans.rollback()


@pytest_asyncio.fixture
async def client(db_session, app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def seeded_tenant(db_session: AsyncSession) -> TenantSeed:
    from app.core.auth.security import create_access_token, hash_password
    from app.models.device_hub import AutomationGateway
    from app.models.domain import Company, User, UserRole
    from app.models.monitoring_models import (
        AlertSeverity,
        MonitoredSystem,
        MonitoringFacility,
        Sensor,
        SensorThreshold,
    )
    from app.services.devices.device_service import DeviceService

    suffix = uuid.uuid4().hex[:8]
    company_id = str(uuid.uuid4())
    worker_id = str(uuid.uuid4())
    manager_id = str(uuid.uuid4())
    facility_id = str(uuid.uuid4())
    zone_id = None
    system_id = str(uuid.uuid4())
    sensor_ok = str(uuid.uuid4())
    sensor_warn = str(uuid.uuid4())
    sensor_crit = str(uuid.uuid4())
    gateway_id = str(uuid.uuid4())
    worker_email = f"worker_{suffix}@example.com"
    manager_email = f"manager_{suffix}@example.com"
    password = "pytest-pass-12345"

    db = db_session
    company = Company(id=company_id, name=f"Pytest Co {suffix}", theme={})
    db.add(company)
    await db.flush()

    worker = User(
        id=worker_id,
        company_id=company_id,
        email=worker_email,
        hashed_password=hash_password(password),
        full_name="Pytest Worker",
        roles=[UserRole.worker.value],
        operational_role="worker",
        is_active=True,
        is_system_admin=False,
    )
    manager = User(
        id=manager_id,
        company_id=company_id,
        email=manager_email,
        hashed_password=hash_password(password),
        full_name="Pytest Manager",
        roles=[UserRole.manager.value],
        operational_role="manager",
        is_active=True,
        is_system_admin=False,
    )
    db.add_all([worker, manager])

    fac = MonitoringFacility(
        id=facility_id,
        company_id=company_id,
        name="Test facility",
        description=None,
        created_at=datetime.now(timezone.utc),
    )
    db.add(fac)
    sys_row = MonitoredSystem(
        id=system_id,
        facility_id=facility_id,
        zone_id=zone_id,
        name="Test system",
        description=None,
    )
    db.add(sys_row)

    s_ok = Sensor(
        id=sensor_ok,
        monitored_system_id=system_id,
        zone_id=zone_id,
        name="Pressure OK",
        external_key=f"pressure_ok_{suffix}",
        unit="psi",
        expected_interval_seconds=300,
    )
    s_warn = Sensor(
        id=sensor_warn,
        monitored_system_id=system_id,
        zone_id=zone_id,
        name="Pressure warn",
        external_key=f"pressure_warn_{suffix}",
        unit="psi",
        expected_interval_seconds=300,
    )
    s_crit = Sensor(
        id=sensor_crit,
        monitored_system_id=system_id,
        zone_id=zone_id,
        name="Pressure crit",
        external_key=f"pressure_crit_{suffix}",
        unit="psi",
        expected_interval_seconds=300,
    )
    db.add_all([s_ok, s_warn, s_crit])

    db.add(
        SensorThreshold(
            id=str(uuid.uuid4()),
            sensor_id=sensor_ok,
            name="Operating band",
            min_value=Decimal("40"),
            max_value=Decimal("120"),
            expected_bool=None,
            is_active=True,
            alert_severity=AlertSeverity.warning,
        )
    )
    db.add(
        SensorThreshold(
            id=str(uuid.uuid4()),
            sensor_id=sensor_warn,
            name="Warning ceiling",
            min_value=None,
            max_value=Decimal("80"),
            expected_bool=None,
            is_active=True,
            alert_severity=AlertSeverity.warning,
        )
    )
    db.add(
        SensorThreshold(
            id=str(uuid.uuid4()),
            sensor_id=sensor_crit,
            name="Critical ceiling",
            min_value=None,
            max_value=Decimal("60"),
            expected_bool=None,
            is_active=True,
            alert_severity=AlertSeverity.critical,
        )
    )

    gw = AutomationGateway(
        id=gateway_id,
        company_id=company_id,
        name="Sim gateway",
        identifier=f"gw-{suffix}",
        status="online",
        assigned=False,
        zone_id=None,
    )
    db.add(gw)
    await db.flush()

    svc = DeviceService(db)
    _, gateway_secret = await svc.rotate_gateway_ingest_secret(company_id=company_id, gateway_id=gateway_id)
    await db.flush()

    worker_token = create_access_token(
        subject=worker_id,
        extra_claims={"company_id": company_id, "role": UserRole.worker.value, "tv": 0},
    )
    manager_token = create_access_token(
        subject=manager_id,
        extra_claims={"company_id": company_id, "role": UserRole.manager.value, "tv": 0},
    )

    return TenantSeed(
        company_id=company_id,
        worker_id=worker_id,
        manager_id=manager_id,
        worker_email=worker_email,
        manager_email=manager_email,
        password=password,
        worker_token=worker_token,
        manager_token=manager_token,
        facility_id=facility_id,
        system_id=system_id,
        sensor_ok_id=sensor_ok,
        sensor_warn_id=sensor_warn,
        sensor_crit_id=sensor_crit,
        gateway_id=gateway_id,
        gateway_secret=gateway_secret,
    )


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def device_headers(gateway_id: str, secret: str) -> dict[str, str]:
    return {
        "X-Gateway-Id": gateway_id,
        "Authorization": f"Bearer {secret}",
        "Content-Type": "application/json",
    }
