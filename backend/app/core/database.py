"""Async SQLAlchemy engine and session factory."""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings

settings = get_settings()

# statement_cache_size=0: required behind PgBouncer (e.g. Render) in transaction pool mode —
# otherwise asyncpg prepared statements error with InvalidSQLStatementNameError.
_engine_connect_args: dict = {}
if settings.database_url.startswith("postgresql+asyncpg"):
    _engine_connect_args["statement_cache_size"] = 0

engine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=True,
    connect_args=_engine_connect_args,
)

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
