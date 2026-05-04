"""Unit tests for project completion / annual archive helpers."""

from __future__ import annotations

import datetime

from app.models.pulse_models import PulseProject
from app.services.projects.completion import is_annual_project, next_period_start_date


def _project(freq: str | None) -> PulseProject:
    return PulseProject(
        company_id="c1",
        name="Test",
        start_date=datetime.date(2025, 1, 1),
        end_date=datetime.date(2025, 6, 30),
        repopulation_frequency=freq,
    )


def test_is_annual_project_positive() -> None:
    assert is_annual_project(_project("annual")) is True
    assert is_annual_project(_project("Yearly")) is True


def test_is_annual_project_negative() -> None:
    assert is_annual_project(_project(None)) is False
    assert is_annual_project(_project("")) is False
    assert is_annual_project(_project("once")) is False
    assert is_annual_project(_project("quarterly")) is False


def test_next_period_start_date_annual() -> None:
    cur = datetime.date(2025, 3, 15)
    nxt = next_period_start_date(cur, "annual")
    assert nxt.year == 2026 and nxt.month == 3 and nxt.day == 15

