"""Regulatory reference catalog — schema, sources, and Vernon starter coverage."""

from app.core.regulatory_reference_catalog import (
    CLASSIFICATIONS,
    DISCLAIMER,
    INTENT_TO_CARD_KEYS,
    PEBPVR_BC_LAWS,
    REFERENCE_CARDS,
    TOPIC_CATEGORIES,
    TSBC_AMMONIA_AWARENESS,
    TSBC_D_BP_2012_03,
    TSBC_D_BP_2024_01,
    TSBC_D_BP_2025_02,
    TSBC_D_BP_2025_04,
    TSBC_IB_DA_2020_01,
    TSBC_ICE_FACILITY_OPERATOR,
    TSBC_REFRIGERATION_DESIGN_REG,
    TSBC_REFRIGERATION_HOME,
    TSBC_REFRIGERATION_OPERATOR,
    TSBC_SO_BP_2017_02,
    VERIFICATION_STATUSES,
    cards_by_key,
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

TSBC_CHIEF_AND_PLANT_KEYS = (
    "chief-engineer-plant-responsibility",
    "tsbc-plant-supervision-vicinity",
    "tsbc-ammonia-public-occupancy",
    "tsbc-general-supervision-risk-assessed",
    "tsbc-ammonia-safety-awareness",
    "tsbc-refrigeration-operator-certificate",
    "tsbc-ice-facility-operator-certificate",
    "pebpvrsr-chief-engineer-definition-duties",
    "pebpvrsr-refrigeration-in-charge-classification",
    "tsbc-secondary-coolant-overpressure",
    "tsbc-refrigeration-design-registration",
    "worksafebc-ammonia-refrigeration",
    "emergency-ammonia-internal-plus-regulators",
    "safety-standards-act-overview",
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
        assert card.get("review_date")
        for extra in card.get("extra_sources") or []:
            assert extra.startswith("https://"), f"{card['key']} extra {extra}"
        pointers = card.get("pulse_pointers") or []
        assert pointers, card["key"]
        for pointer in pointers:
            assert pointer.get("label")
            assert pointer.get("href") or pointer.get("match_title")


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
        "refrigeration operator",
        "ice facility operator",
        "general supervision",
        "safety order",
        "secondary coolant",
        "design registration",
        "section 68",
    ):
        assert needle in blob, needle


def test_catalog_public_dicts() -> None:
    rows = catalog_as_public_dicts()
    assert rows[0]["key"] == REFERENCE_CARDS[0]["key"]
    assert "summary" in rows[0]


def test_tsbc_chief_engineer_and_refrigeration_cards() -> None:
    catalog = cards_by_key()
    for key in TSBC_CHIEF_AND_PLANT_KEYS:
        assert key in catalog, key
        card = catalog[key]
        assert card["review_date"] == "2026-09-16", key
        assert card["topic_category"] in {"Chief Engineer", "Refrigeration / TSBC", "OH&S", "Emergency"}

    chief = catalog["chief-engineer-plant-responsibility"]
    assert chief["official_source_url"] == TSBC_D_BP_2012_03
    assert PEBPVR_BC_LAWS in (chief.get("extra_sources") or [])
    assert "96 hours" in chief["summary"]
    assert "44(2.1)" in chief["summary"]
    assert "does not decide" in chief["summary"].lower()
    assert chief["topic_category"] == "Chief Engineer"

    occupancy = catalog["tsbc-ammonia-public-occupancy"]
    assert occupancy["official_source_url"] == TSBC_SO_BP_2017_02
    assert occupancy["topic_category"] == "Refrigeration / TSBC"
    assert "50 kW" in occupancy["applicability"] or "50 kW" in occupancy["summary"]
    assert "Plant Supervision Program" in occupancy["summary"]
    assert "1,000 kW" in occupancy["summary"]

    vicinity = catalog["tsbc-plant-supervision-vicinity"]
    assert vicinity["official_source_url"] == TSBC_D_BP_2025_04
    assert "D-BP 2025-04" in vicinity["regulation_name"]

    special = catalog["tsbc-general-supervision-risk-assessed"]
    assert special["official_source_url"] == TSBC_D_BP_2024_01
    assert "MAN-4000" in special["summary"]
    assert any("MAN-4000" in src for src in special["extra_sources"])

    awareness = catalog["tsbc-ammonia-safety-awareness"]
    assert awareness["official_source_url"] == TSBC_AMMONIA_AWARENESS
    assert "24 hours" in awareness["summary"]

    ro = catalog["tsbc-refrigeration-operator-certificate"]
    assert ro["official_source_url"] == TSBC_REFRIGERATION_OPERATOR
    assert ro["topic_category"] == "Chief Engineer"
    ifo = catalog["tsbc-ice-facility-operator-certificate"]
    assert ifo["official_source_url"] == TSBC_ICE_FACILITY_OPERATOR
    assert ifo["topic_category"] == "Chief Engineer"

    duties = catalog["pebpvrsr-chief-engineer-definition-duties"]
    assert duties["official_source_url"] == PEBPVR_BC_LAWS
    assert TSBC_REFRIGERATION_HOME in (duties.get("extra_sources") or [])
    assert "s. 68" in duties["summary"]
    assert "s. 69" in duties["summary"]
    assert "does not decide" in duties["applicability"].lower()

    classify = catalog["pebpvrsr-refrigeration-in-charge-classification"]
    assert classify["official_source_url"] == PEBPVR_BC_LAWS
    assert "B2L" in classify["summary"]
    assert "44(2.1)" in classify["summary"]
    assert "not legal advice" in classify["summary"].lower()

    coolant = catalog["tsbc-secondary-coolant-overpressure"]
    assert coolant["official_source_url"] == TSBC_D_BP_2025_02
    assert "D-BP 2025-02" in coolant["regulation_name"]
    assert "does not paste CSA B52" in coolant["summary"]

    design = catalog["tsbc-refrigeration-design-registration"]
    assert design["official_source_url"] == TSBC_IB_DA_2020_01
    assert TSBC_REFRIGERATION_DESIGN_REG in (design.get("extra_sources") or [])
    assert "s. 84" in design["summary"]

    assert "not legal advice" in DISCLAIMER.lower()


def test_intent_map_only_references_catalog_keys() -> None:
    keys = {c["key"] for c in REFERENCE_CARDS}
    for intent, card_keys in INTENT_TO_CARD_KEYS.items():
        for key in card_keys:
            assert key in keys, f"{intent} -> {key}"
        assert card_keys, intent
