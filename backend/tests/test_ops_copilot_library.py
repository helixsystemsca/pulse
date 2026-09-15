"""Ops Copilot prompt library — Vernon recreation starter questions."""

from app.services.ops_copilot_service import PROMPT_LIBRARY


def test_prompt_library_covers_vernon_ops() -> None:
    ids = {p["id"] for p in PROMPT_LIBRARY}
    assert {
        "overdue-arena",
        "overdue-aquatic",
        "qualified-ice-plant",
        "ammonia-release",
        "pool-emergency",
        "certs-this-month",
        "contractor-insurance",
        "assets-without-pms",
        "chief-engineer",
        "ohs-worksafebc",
        "building-code",
        "interior-health-pools",
        "refrigeration-plant",
    }.issubset(ids)
    for p in PROMPT_LIBRARY:
        assert p["label"]
        assert p["prompt"]
        assert p["hint"]
