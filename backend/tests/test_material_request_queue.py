"""Material request queue status helpers."""

import pytest

from app.services.material_request_queue_service import (
    QUEUE_EXPORTABLE_STATUSES,
    QUEUE_STATUS_EXPORTED,
    QUEUE_STATUS_ON_ORDER,
    QUEUE_STATUS_PENDING,
    QUEUE_VISIBLE_STATUSES,
    clear_mr_requested_flag,
    queue_row_mr_requested,
)


def test_visible_includes_on_order_and_pending() -> None:
    assert QUEUE_STATUS_PENDING in QUEUE_VISIBLE_STATUSES
    assert QUEUE_STATUS_ON_ORDER in QUEUE_VISIBLE_STATUSES
    assert QUEUE_STATUS_EXPORTED in QUEUE_VISIBLE_STATUSES


def test_exportable_includes_on_order() -> None:
    assert QUEUE_STATUS_ON_ORDER in QUEUE_EXPORTABLE_STATUSES
    assert QUEUE_STATUS_PENDING in QUEUE_EXPORTABLE_STATUSES


@pytest.mark.asyncio
async def test_clear_mr_requested_flag() -> None:
    from types import SimpleNamespace
    from unittest.mock import AsyncMock

    row = SimpleNamespace(
        status=QUEUE_STATUS_ON_ORDER,
        exported_at="2026-01-01T00:00:00Z",
        export_batch_id="batch-1",
        updated_at=None,
    )
    db = AsyncMock()
    out = await clear_mr_requested_flag(db, row)  # type: ignore[arg-type]
    assert out.status == QUEUE_STATUS_PENDING
    assert out.exported_at is None
    assert out.export_batch_id is None


def test_queue_row_mr_requested() -> None:
    from types import SimpleNamespace

    pending = SimpleNamespace(exported_at=None, status=QUEUE_STATUS_PENDING)
    assert queue_row_mr_requested(pending) is False
    on_order = SimpleNamespace(exported_at=None, status=QUEUE_STATUS_ON_ORDER)
    assert queue_row_mr_requested(on_order) is True
