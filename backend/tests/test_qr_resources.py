"""QR resource token and registry helpers."""

from app.core.qr_guest_access import guest_may_perform, is_guest_read_only_enabled, redact_guest_payload
from app.core.qr_resource_types import destination_for, normalize_resource_type
from app.services.qr_resource_service import generate_qr_token


def test_generate_qr_token_unique() -> None:
    existing = {"ABC123"}
    token = generate_qr_token(existing)
    assert token not in existing
    assert len(token) == 10


def test_normalize_resource_type() -> None:
    assert normalize_resource_type("equipment") == "equipment"
    assert normalize_resource_type("invalid") is None


def test_destination_for_equipment() -> None:
    assert destination_for("equipment", "eq-1") == "/equipment/eq-1"
    assert destination_for("equipment", "eq-1", guest=True) == "/equipment/eq-1?guest=1"


def test_guest_permissions() -> None:
    assert is_guest_read_only_enabled(True, "read_only") is True
    assert guest_may_perform("view_costs") is False
    assert guest_may_perform("create") is False


def test_redact_guest_payload() -> None:
    out = redact_guest_payload({"name": "Pump", "unit_cost": 12.5, "vendor": "Acme"})
    assert out["name"] == "Pump"
    assert "unit_cost" not in out
    assert "vendor" not in out
