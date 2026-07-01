"""Master development plan templates per performance quadrant."""

from __future__ import annotations

from typing import Any

QUADRANT_LABELS: dict[str, str] = {
    "A": "High Performer",
    "B": "Solid Contributor",
    "C": "Developing",
    "D": "Needs Improvement",
}

DEFAULT_STATUS_BY_QUADRANT: dict[str, str] = {
    "A": "on_track",
    "B": "developing",
    "C": "developing",
    "D": "action_required",
}

QUADRANT_TEMPLATES: dict[str, dict[str, Any]] = {
    "A": {
        "objective": "Retain and prepare for future leadership.",
        "milestones": {
            "30": [
                "Identify stretch assignment",
                "Career discussion",
                "Recognition",
            ],
            "60": [
                "Lead project",
                "Mentor another employee",
                "Cross-training",
            ],
            "90": [
                "Promotion readiness review",
                "Leadership planning",
                "Succession discussion",
            ],
        },
    },
    "B": {
        "objective": "Develop into an A Performer.",
        "milestones": {
            "30": [
                "Assign ownership",
                "Weekly coaching",
                "Training assignment",
            ],
            "60": [
                "Lead a small project",
                "Cross-training",
                "Feedback session",
            ],
            "90": [
                "Quarterly review",
                "Evaluate promotion potential",
            ],
        },
    },
    "C": {
        "objective": "Improve consistency and engagement.",
        "milestones": {
            "30": [
                "Weekly check-ins",
                "Clarify expectations",
                "Training",
            ],
            "60": [
                "Review progress",
                "Remove barriers",
                "Measure improvements",
            ],
            "90": [
                "Reassess performance",
                "Determine if moved to B",
            ],
        },
    },
    "D": {
        "objective": "Correct performance issues.",
        "milestones": {
            "30": [
                "Formal coaching",
                "Document expectations",
                "Weekly meetings",
            ],
            "60": [
                "Evaluate progress",
                "Additional coaching",
            ],
            "90": [
                "Determine next steps",
                "Continue coaching or begin HR process",
            ],
        },
    },
}


def build_plan_from_template(quadrant: str, *, generated_at_iso: str) -> dict[str, Any]:
    q = quadrant if quadrant in QUADRANT_TEMPLATES else "C"
    tpl = QUADRANT_TEMPLATES[q]
    return {
        "objective": tpl["objective"],
        "quadrant": q,
        "generated_at": generated_at_iso,
        "milestones": dict(tpl["milestones"]),
        "custom_notes": None,
    }
