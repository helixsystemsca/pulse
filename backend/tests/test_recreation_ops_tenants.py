"""Unit tests for City of Vernon Recreation Ops pinning."""

from app.core.features.recreation_ops_tenants import (
    recreation_ops_forced_for_company_name,
    recreation_ops_forced_for_email,
)


def test_vernon_company_name_match() -> None:
    assert recreation_ops_forced_for_company_name("City of Vernon")
    assert recreation_ops_forced_for_company_name("CITY OF VERNON Recreation")
    assert not recreation_ops_forced_for_company_name("Panorama")
    assert not recreation_ops_forced_for_company_name(None)


def test_vernon_admin_email_match() -> None:
    assert recreation_ops_forced_for_email("josh@vernon.ca")
    assert recreation_ops_forced_for_email("Josh@Vernon.ca")
    assert not recreation_ops_forced_for_email("other@vernon.ca")


def test_vernon_pins_daily_planner() -> None:
    from app.core.features.recreation_ops_tenants import DAILY_PLANNER_FEATURE, VERNON_PINNED_FEATURES

    assert DAILY_PLANNER_FEATURE in VERNON_PINNED_FEATURES
    assert "recreation_ops" in VERNON_PINNED_FEATURES
