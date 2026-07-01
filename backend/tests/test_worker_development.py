"""Tests for worker development quadrant templates and scoring."""

from __future__ import annotations

from app.services.worker_development.templates import QUADRANT_TEMPLATES, build_plan_from_template
from app.services.worker_development.service import _scores_from_assessment


def test_build_plan_from_template_a():
    plan = build_plan_from_template("A", generated_at_iso="2026-06-01T00:00:00+00:00")
    assert plan["quadrant"] == "A"
    assert "30" in plan["milestones"]
    assert len(plan["milestones"]["30"]) >= 2


def test_build_plan_defaults_to_c_for_unknown():
    plan = build_plan_from_template("Z", generated_at_iso="2026-06-01T00:00:00+00:00")
    assert plan["quadrant"] == "C"
    assert plan["objective"] == QUADRANT_TEMPLATES["C"]["objective"]


def test_scores_from_assessment_averages():
    perf, pot = _scores_from_assessment(
        {
            "reliability": 4,
            "technical_skills": 5,
            "initiative": 3,
            "leadership_potential": 4,
            "engagement": 2,
        },
    )
    assert perf == 4.0
    assert pot == 3.0
