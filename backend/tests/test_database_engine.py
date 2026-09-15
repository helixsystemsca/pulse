"""Engine connect_args for Render/Supabase poolers — no named prepared statements."""

from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.database import (
    connect_args_for_url,
    engine_kwargs_for_url,
    is_transaction_pooler_url,
    postgres_driver_from_url,
)
from app.services import ops_foundation_service as svc


def test_postgres_driver_from_url() -> None:
    assert postgres_driver_from_url("postgresql+asyncpg://u:p@h/db") == "asyncpg"
    assert postgres_driver_from_url("postgresql+psycopg://u:p@h/db") == "psycopg"
    assert postgres_driver_from_url("postgresql://u:p@h/db") == ""


def test_connect_args_disable_prepared_statements_for_both_drivers() -> None:
    asyncpg = connect_args_for_url(
        "postgresql+asyncpg://pulse_app:x@aws-0-us-west-2.pooler.supabase.com:6543/postgres"
    )
    assert asyncpg == {"statement_cache_size": 0}

    psycopg = connect_args_for_url(
        "postgresql+psycopg://pulse_app:x@aws-0-us-west-2.pooler.supabase.com:6543/postgres"
    )
    assert psycopg == {"prepare_threshold": None}


def test_pooler_url_uses_null_pool() -> None:
    supabase = engine_kwargs_for_url(
        "postgresql+asyncpg://pulse_app:x@aws-0-us-west-2.pooler.supabase.com:5432/postgres"
    )
    assert supabase["poolclass"] is NullPool
    assert supabase["connect_args"]["statement_cache_size"] == 0

    port = engine_kwargs_for_url("postgresql+psycopg://pulse_app:x@db.example:6543/postgres")
    assert is_transaction_pooler_url("postgresql+psycopg://pulse_app:x@db.example:6543/postgres")
    assert port["poolclass"] is NullPool
    assert port["connect_args"]["prepare_threshold"] is None

    flagged = engine_kwargs_for_url("postgresql+asyncpg://pulse_app:x@db.example:5432/postgres?pgbouncer=true")
    assert flagged["poolclass"] is NullPool


def test_direct_postgres_keeps_bounded_pool() -> None:
    kw = engine_kwargs_for_url("postgresql+asyncpg://postgres:postgres@localhost:5432/ops_intel")
    assert "poolclass" not in kw
    assert kw["pool_size"] == 5
    assert kw["connect_args"]["statement_cache_size"] == 0


def _sync_dsn(async_url: str) -> str:
    return async_url.replace("postgresql+asyncpg://", "postgresql://").replace(
        "postgresql+psycopg://", "postgresql://"
    )


def test_leftover_pg3_prepare_is_the_pooler_failure_mode(test_database) -> None:
    """Recycled PgBouncer/Supabase backends keep ``_pg3_0``; default psycopg then 500s."""
    import psycopg
    from psycopg.errors import DuplicatePreparedStatement

    dsn = _sync_dsn(test_database.async_url)
    with psycopg.connect(dsn) as conn:
        conn.execute("PREPARE _pg3_0 AS SELECT 1")
        with pytest.raises(DuplicatePreparedStatement, match="_pg3_0"):
            for _ in range(6):
                conn.execute("SELECT 1 WHERE 1 = %s", (1,))


def test_prepare_threshold_none_survives_leftover_pg3_name(test_database) -> None:
    """The engine connect_args we pass for psycopg skip PREPARE entirely."""
    import psycopg

    dsn = _sync_dsn(test_database.async_url)
    args = connect_args_for_url("postgresql+psycopg://pulse_app@host:6543/postgres")
    assert args["prepare_threshold"] is None
    with psycopg.connect(dsn, **args) as conn:
        conn.execute("PREPARE _pg3_0 AS SELECT 1")
        for _ in range(8):
            conn.execute(
                "SELECT 1 FROM ops_entity_links WHERE company_id = %s AND from_type = %s",
                (str(uuid4()), "regulations"),
            )


@pytest.mark.asyncio
async def test_list_links_for_survives_leftover_pg3_on_psycopg_engine(test_database) -> None:
    """Same SELECT as GET /regulations link hydration, on a dirty pooled backend."""
    psycopg_url = test_database.async_url.replace("postgresql+asyncpg://", "postgresql+psycopg://")
    engine = create_async_engine(psycopg_url, **engine_kwargs_for_url(psycopg_url))
    try:
        async with engine.connect() as conn:
            await conn.exec_driver_sql("PREPARE _pg3_0 AS SELECT 1")
            session = AsyncSession(bind=conn, expire_on_commit=False, autoflush=False)
            try:
                cid = str(uuid4())
                for _ in range(8):
                    links = await svc.list_links_for(session, cid, "regulations", str(uuid4()))
                    assert links == []
            finally:
                await session.close()
    finally:
        await engine.dispose()
