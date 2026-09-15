"""Regulatory reference catalog — schema, sources, and Vernon starter coverage."""

from app.core.regulatory_reference_catalog import (
    CLASSIFICATIONS,
    REFERENCE_CARDS,
    TOPIC_CATEGORIES,
    VERIFICATION_STATUSES,
    catalog_as_public_dicts,
)


REQUIRED_KEYS = (
    "key",
    "title",
    "topic_category",
    "classification",
    "summary",
    "applicability",
    "official_source_name",
    "official_source_url",
    "verification_status",
)


def test_catalog_schema_and_public_urls() -> None:
    assert len(REFERENCE_CARDS) >= 12
    keys = [c["key"] for c in REFERENCE_CARDS]
    assert len(keys) == len(set(keys))
    for card in REFERENCE_CARDS:
        for k in REQUIRED_KEYS:
            assert card.get(k), f"{card.get('key')} missing {k}"
        assert card["topic_category"] in TOPIC_CATEGORIES
        assert card["classification"] in CLASSIFICATIONS
        assert card["verification_status"] in VERIFICATION_STATUSES
        url = card["official_source_url"]
        assert url.startswith("https://"), card["key"]
        assert "you must by law" not in card["summary"].lower()
        assert card["official_source_name"].strip()


def test_starter_topics_cover_josh_briefs() -> None:
    blob = " ".join(c["title"] + " " + " ".join(c.get("keywords") or []) for c in REFERENCE_CARDS).lower()
    for needle in (
        "chief engineer",
        "worksafebc",
        "building code",
        "interior health",
        "pool regulation",
        "ammonia",
        "refrigeration",
        "fire",
        "electrical",
        "playground",
        "whmis",
    ):
        assert needle in blob, needle


def test_catalog_public_dicts() -> None:
    rows = catalog_as_public_dicts()
    assert rows[0]["key"] == REFERENCE_CARDS[0]["key"]
    assert "summary" in rows[0]
