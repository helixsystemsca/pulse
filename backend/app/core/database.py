"""Async SQLAlchemy engine and session factory."""

from collections.abc import AsyncGenerator
from typing import Any
from urllib.parse import urlparse

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import get_settings

# Named prepared-statement caches are unsafe behind PgBouncer / Supabase transaction
# poolers (Render production). A recycled backend may already have `_pg3_0` (psycopg)
# or asyncpg's cached name. Disable driver-side prepare caches for every Postgres
# dialect we support. This does not change RLS, tenant filters, or role grants.


def postgres_driver_from_url(database_url: str) -> str:
    scheme = ((database_url or "").split("://", 1)[0] or "").lower()
    if "+" in scheme:
        return scheme.split("+", 1)[1]
    return ""


def is_transaction_pooler_url(database_url: str) -> bool:
    raw = (database_url or "").lower()
    if "pooler.supabase.com" in raw or "pgbouncer=true" in raw:
        return True
    if ":6543/" in raw or ":6543?" in raw or raw.rstrip("/").endswith(":6543"):
        return True
    try:
        if urlparse(raw).port == 6543:
            return True
    except ValueError:
        return False
    return False


def connect_args_for_url(database_url: str) -> dict[str, Any]:
    """Driver connect_args that disable named prepared statements.

    * asyncpg: ``statement_cache_size=0`` (avoids InvalidSQLStatementNameError).
    * psycopg3: ``prepare_threshold=None`` (avoids DuplicatePreparedStatement on
      leftover ``_pg3_*`` names when a pooler reuses a backend).
    """
    driver = postgres_driver_from_url(database_url)
    if driver.startswith("asyncpg"):
        return {"statement_cache_size": 0}
    if driver.startswith("psycopg"):
        return {"prepare_threshold": None}
    return {}


def engine_kwargs_for_url(database_url: str) -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        "echo": False,
        "pool_pre_ping": True,
        "connect_args": connect_args_for_url(database_url),
    }
    if is_transaction_pooler_url(database_url):
        # Avoid stacking a client pool on a transaction pooler (prepared-statement
        # collisions and pooler-slot exhaustion per replica).
        kwargs["poolclass"] = NullPool
    else:
        kwargs.update(
            pool_size=5,
            max_overflow=10,
            pool_timeout=30,
            pool_recycle=1800,
        )
    return kwargs


settings = get_settings()

engine = create_async_engine(settings.database_url, **engine_kwargs_for_url(settings.database_url))

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
