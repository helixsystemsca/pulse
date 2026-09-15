"""30/60/90 expiry classification used by certs, insurance, and WCB."""

from datetime import date

from app.services.ops_compliance_dates import classify_expiry, days_until, is_attention


def test_classify_expiry_windows() -> None:
    today = date(2026, 9, 15)
    assert classify_expiry(None, today=today) == "missing"
    assert classify_expiry(date(2026, 9, 1), today=today) == "expired"
    assert classify_expiry(date(2026, 10, 1), today=today) == "expiring_30"
    assert classify_expiry(date(2026, 11, 1), today=today) == "expiring_60"
    assert classify_expiry(date(2026, 12, 10), today=today) == "expiring_90"
    assert classify_expiry(date(2027, 3, 1), today=today) == "ok"
    assert days_until(date(2026, 9, 20), today=today) == 5
    assert is_attention("expired")
    assert not is_attention("ok")
