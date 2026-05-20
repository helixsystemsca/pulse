"""Unit tests for schedule department slug helpers."""

from app.core.schedule_department import (
    DEFAULT_SCHEDULE_DEPARTMENT_SLUG,
    normalize_schedule_department_slug,
    primary_department_slug_from_hr,
)
from app.models.pulse_models import PulseWorkerHR


def test_normalize_schedule_department_slug() -> None:
    assert normalize_schedule_department_slug("Communications") == "communications"
    assert normalize_schedule_department_slug("invalid") is None
    assert normalize_schedule_department_slug(None) is None


def test_primary_department_slug_from_hr() -> None:
    hr = PulseWorkerHR(
        user_id="u1",
        company_id="c1",
        department_slugs=["communications"],
    )
    assert primary_department_slug_from_hr(hr) == "communications"
    hr2 = PulseWorkerHR(user_id="u2", company_id="c1", department="maintenance")
    assert primary_department_slug_from_hr(hr2) == "maintenance"
    assert primary_department_slug_from_hr(None) is None


def test_default_slug() -> None:
    assert DEFAULT_SCHEDULE_DEPARTMENT_SLUG == "maintenance"
