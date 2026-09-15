"""Contractor pack insurance / WCB highlighting."""

from datetime import date
from types import SimpleNamespace

from app.services.contractor_compliance import contractor_compliance


def test_contractor_expired_insurance() -> None:
    today = date(2026, 9, 15)
    row = SimpleNamespace(
        insurance_expiry=date(2026, 8, 1),
        wcb_expiry=date(2027, 1, 1),
        tickets=[{"name": "Refrigeration ticket", "expiry": "2026-10-01"}],
    )
    pack = contractor_compliance(row, today=today)
    assert pack["insurance_status"] == "expired"
    assert pack["has_attention"] is True
    assert pack["overall_status"] == "expired"
    kinds = {a["kind"] for a in pack["alerts"]}
    assert "insurance" in kinds
    assert "ticket" in kinds


def test_contractor_ok_when_dates_far() -> None:
    today = date(2026, 9, 15)
    row = SimpleNamespace(
        insurance_expiry=date(2027, 9, 15),
        wcb_expiry=date(2027, 9, 15),
        tickets=["WHMIS"],
    )
    pack = contractor_compliance(row, today=today)
    assert pack["has_attention"] is False
    assert pack["overall_status"] == "ok"
