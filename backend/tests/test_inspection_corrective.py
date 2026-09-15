"""Inspection fail mapping and overall result."""

from app.services.inspection_service import _overall_from_items, item_is_fail


def test_item_is_fail_synonyms() -> None:
    assert item_is_fail("fail")
    assert item_is_fail("Failed")
    assert item_is_fail("no")
    assert item_is_fail("unacceptable")
    assert not item_is_fail("pass")
    assert not item_is_fail(None)


def test_overall_from_failed_item() -> None:
    assert _overall_from_items([{"result": "fail"}], None) == "fail"
    assert _overall_from_items([{"result": "pass"}], None) == "pass"
    assert _overall_from_items([], None) == "incomplete"
    assert _overall_from_items([{"result": "pass"}], "unacceptable") == "fail"
