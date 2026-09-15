"""Unit tests for City of Vernon Recreation Ops pinning."""

from types import SimpleNamespace

from app.core.features.recreation_ops_tenants import (
    VERNON_DEFAULT_LOGO_URL,
    apply_vernon_default_logo,
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


def test_vernon_default_logo_seeded_when_empty() -> None:
    company = SimpleNamespace(name="City of Vernon", logo_url=None, logo_storage_key=None)
    assert apply_vernon_default_logo(company) is True
    assert company.logo_url == VERNON_DEFAULT_LOGO_URL
    assert apply_vernon_default_logo(company) is False


def test_vernon_default_logo_does_not_clobber_upload() -> None:
    company = SimpleNamespace(
        name="City of Vernon",
        logo_url="/api/v1/company/logo",
        logo_storage_key="companies/abc/logo.png",
    )
    assert apply_vernon_default_logo(company) is False
    assert company.logo_url == "/api/v1/company/logo"


def test_vernon_default_logo_skips_other_tenants() -> None:
    company = SimpleNamespace(name="Panorama", logo_url=None, logo_storage_key=None)
    assert apply_vernon_default_logo(company) is False
    assert company.logo_url is None
