"""Flyout feature keys in contract expansion and matrix sanitization."""

from __future__ import annotations

from app.core.dashboard_matrix_grants import matrix_feature_keys_allowed_in_settings
from app.core.features.canonical_catalog import canonical_keys_from_contract


def test_contract_schedule_expands_flyout_keys() -> None:
    keys = canonical_keys_from_contract(["schedule"])
    assert "schedule" in keys
    assert "schedule_availability" in keys
    assert "schedule_coverage" in keys
    assert "schedule_shift_definitions" in keys
    assert "pm_workspace" not in keys


def test_matrix_may_store_flyout_keys() -> None:
    allowed = matrix_feature_keys_allowed_in_settings()
    assert "schedule_availability" in allowed
    assert "standards_my_procedures" in allowed
    assert "facilities_spatial" in allowed
