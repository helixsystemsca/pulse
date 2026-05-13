"""Async SQLAlchemy engine and session factory."""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import get_settings

settings = get_settings()

# statement_cache_size=0: required behind PgBouncer (e.g. Render) in transaction pool mode —
# otherwise asyncpg prepared statements error with InvalidSQLStatementNameError.
_engine_connect_args: dict = {}
if settings.database_url.startswith("postgresql+asyncpg"):
    _engine_connect_args["statement_cache_size"] = 0

_db_url_lower = settings.database_url.lower()
# Supabase pooler + similar transaction-pooler setups: avoid server-side connection pooling on the client
# (prepared statements + pooled connections conflict; also avoids exhausting pooler slots per replica).
_use_null_pool = "pooler.supabase.com" in _db_url_lower or ":6543/" in _db_url_lower

_engine_kw: dict = {
    "echo": False,
    "pool_pre_ping": True,
    "connect_args": _engine_connect_args,
}
if _use_null_pool:
    _engine_kw["poolclass"] = NullPool
else:
    _engine_kw.update(
        pool_size=5,
        max_overflow=10,
        pool_timeout=30,
        pool_recycle=1800,
    )

engine = create_async_engine(settings.database_url, **_engine_kw)

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
