"""
Provision a PostgreSQL database for pytest (Docker when TEST_DATABASE_URL is unset).

Integration tests require PostgreSQL (pg INSERT … ON CONFLICT, etc.); there is no SQLite fallback.
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
import time
import uuid
from dataclasses import dataclass
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent

DOCKER_IMAGE = os.environ.get("HELIX_TEST_POSTGRES_IMAGE", "postgres:16-alpine")
DOCKER_PASSWORD = os.environ.get("HELIX_TEST_POSTGRES_PASSWORD", "pytest_helix_pg_secret")
DOCKER_DB = os.environ.get("HELIX_TEST_POSTGRES_DB", "helix_pytest")
WAIT_TIMEOUT_S = float(os.environ.get("HELIX_TEST_PG_WAIT_S", "60"))
WAIT_INTERVAL_S = 0.5


class TestDbUnavailable(Exception):
    """Raised when no usable PostgreSQL test database can be prepared."""


@dataclass
class TestDbInfo:
    """Session-scoped DB handle; tear down managed Docker container if any."""

    async_url: str
    managed_container_id: str | None = None

    def teardown(self) -> None:
        _dispose_engine_if_loaded()
        if self.managed_container_id:
            subprocess.run(
                ["docker", "stop", self.managed_container_id],
                capture_output=True,
                text=True,
                timeout=120,
            )


def _dispose_engine_if_loaded() -> None:
    if "app.core.database" not in sys.modules:
        return
    import asyncio

    from app.core.database import engine

    try:
        asyncio.run(engine.dispose())
    except RuntimeError:
        loop = asyncio.new_event_loop()
        try:
            loop.run_until_complete(engine.dispose())
        finally:
            loop.close()


def _async_to_sync_dsn(async_url: str) -> str:
    u = async_url.replace("postgresql+asyncpg://", "postgresql://")
    u = u.replace("postgresql+psycopg://", "postgresql://")
    return u


def _ping_postgres(async_url: str, *, timeout_s: float = 5.0) -> None:
    import psycopg

    dsn = _async_to_sync_dsn(async_url)
    deadline = time.monotonic() + timeout_s
    last: Exception | None = None
    while time.monotonic() < deadline:
        try:
            with psycopg.connect(dsn, connect_timeout=3) as conn:
                conn.execute("SELECT 1")
            return
        except Exception as e:
            last = e
            time.sleep(WAIT_INTERVAL_S)
    raise TestDbUnavailable(
        f"Test DB not available: PostgreSQL did not accept connections within {timeout_s}s ({last!r})."
    ) from last


def _wait_for_docker_postgres(async_url: str) -> None:
    deadline = time.monotonic() + WAIT_TIMEOUT_S
    last: Exception | None = None
    while time.monotonic() < deadline:
        try:
            _ping_postgres(async_url, timeout_s=3.0)
            return
        except Exception as e:
            last = e
            time.sleep(WAIT_INTERVAL_S)
    raise TestDbUnavailable(
        f"Test DB not available: Docker Postgres not ready after {WAIT_TIMEOUT_S}s ({last!r})."
    ) from last


def _docker_port_host_port(container_id: str) -> int:
    r = subprocess.run(
        ["docker", "port", container_id, "5432"],
        capture_output=True,
        text=True,
        timeout=30,
    )
    if r.returncode != 0:
        raise TestDbUnavailable(
            f"Test DB not available: docker port failed: {r.stderr or r.stdout or r.returncode}"
        )
    # e.g. "0.0.0.0:32768" or "[::]:32768"
    for line in r.stdout.strip().splitlines():
        m = re.search(r":(\d+)\s*$", line.strip())
        if m:
            return int(m.group(1))
    raise TestDbUnavailable(f"Test DB not available: could not parse docker port output: {r.stdout!r}")


def _start_docker_postgres() -> TestDbInfo:
    try:
        subprocess.run(
            ["docker", "info"],
            capture_output=True,
            text=True,
            timeout=15,
            check=True,
        )
    except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired) as e:
        raise TestDbUnavailable(
            "Test DB not available: Docker is not running or not installed. "
            "Start Docker Desktop, or set TEST_DATABASE_URL to a reachable PostgreSQL database."
        ) from e

    name = f"helix-pytest-pg-{uuid.uuid4().hex[:10]}"
    r = subprocess.run(
        [
            "docker",
            "run",
            "-d",
            "--rm",
            "--name",
            name,
            "-e",
            f"POSTGRES_USER=postgres",
            "-e",
            f"POSTGRES_PASSWORD={DOCKER_PASSWORD}",
            "-e",
            f"POSTGRES_DB={DOCKER_DB}",
            "-p",
            "0:5432",
            DOCKER_IMAGE,
        ],
        capture_output=True,
        text=True,
        timeout=120,
    )
    if r.returncode != 0:
        raise TestDbUnavailable(
            f"Test DB not available: docker run failed: {r.stderr or r.stdout}"
        )
    cid = r.stdout.strip()
    try:
        port = _docker_port_host_port(cid)
        host = os.environ.get("HELIX_TEST_PG_HOST", "127.0.0.1")
        async_url = (
            f"postgresql+asyncpg://postgres:{DOCKER_PASSWORD}@{host}:{port}/{DOCKER_DB}"
        )
        _wait_for_docker_postgres(async_url)
        return TestDbInfo(async_url=async_url, managed_container_id=cid)
    except Exception:
        subprocess.run(["docker", "stop", cid], capture_output=True, text=True, timeout=60)
        raise


def _run_alembic_upgrade(async_url: str) -> None:
    env = os.environ.copy()
    env["DATABASE_URL"] = async_url
    r = subprocess.run(
        [sys.executable, "scripts/alembic_migrate.py"],
        cwd=BACKEND_ROOT,
        env=env,
        capture_output=True,
        text=True,
        timeout=600,
    )
    if r.returncode != 0:
        raise TestDbUnavailable(
            "Test DB not available: alembic migrate failed.\n"
            f"{r.stderr or r.stdout}"
        )


def provision_test_database() -> TestDbInfo:
    """
    Ensure DATABASE_URL / TEST_DATABASE_URL point at a migrated PostgreSQL database.

    - If TEST_DATABASE_URL is set: use it (fail fast if unreachable).
    - Else: start a temporary Postgres container, migrate, stop container on session teardown.
    """
    explicit = os.environ.get("TEST_DATABASE_URL", "").strip()
    if explicit:
        info = TestDbInfo(async_url=explicit, managed_container_id=None)
        _ping_postgres(explicit, timeout_s=15.0)
        os.environ["DATABASE_URL"] = explicit
        _run_alembic_upgrade(explicit)
        return info

    info = _start_docker_postgres()
    os.environ["DATABASE_URL"] = info.async_url
    os.environ["TEST_DATABASE_URL"] = info.async_url
    _run_alembic_upgrade(info.async_url)
    return info
