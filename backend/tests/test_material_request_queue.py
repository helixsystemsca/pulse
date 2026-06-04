"""Material request queue status helpers."""

from app.services.material_request_queue_service import (
    QUEUE_EXPORTABLE_STATUSES,
    QUEUE_STATUS_EXPORTED,
    QUEUE_STATUS_PENDING,
    QUEUE_VISIBLE_STATUSES,
)


def test_visible_includes_exported_pending() -> None:
    assert QUEUE_STATUS_PENDING in QUEUE_VISIBLE_STATUSES
    assert QUEUE_STATUS_EXPORTED in QUEUE_VISIBLE_STATUSES


def test_exportable_excludes_exported() -> None:
    assert QUEUE_STATUS_EXPORTED not in QUEUE_EXPORTABLE_STATUSES
    assert QUEUE_STATUS_PENDING in QUEUE_EXPORTABLE_STATUSES
