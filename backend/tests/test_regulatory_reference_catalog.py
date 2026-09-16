"""Regulatory reference catalog — schema, sources, and Vernon starter coverage."""

from app.core.regulatory_reference_catalog import (
    CLASSIFICATIONS,
    DISCLAIMER,
    INTENT_TO_CARD_KEYS,
    PEBPVR_BC_LAWS,
    POOL_REG_BC_LAWS,
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
    IH_REC_WATER_PERMITS,
    MOH_REC_WATER,
    VERIFICATION_STATUSES,
    WSBC_AMMONIA_GUIDE,
    WSBC_CHLORAMINES_ARTICLE,
    WSBC_CHLORINE_ADVISORY,
    WSBC_OHS_SEARCHABLE,
    WSBC_WHMIS,
    BCRPA_POOLSAFE_RESOURCES,
    BC_CODES,
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
        "chloramine",
        "chlorine",
        "pool permit",
        "poolsafebc",
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


REC_OPS_ENRICHED_KEYS = (
    "interior-health-recreational-water",
    "bc-pool-regulation",
    "pool-chemistry-public-health-angle",
    "worksafebc-ohs-how-to-look-up",
    "worksafebc-whmis-chemicals",
    "worksafebc-ammonia-refrigeration",
    "bc-building-code-how-it-applies",
    "bc-fire-code-and-vernon-fire-bylaw",
    "playground-csa-z614",
    "emergency-ammonia-internal-plus-regulators",
)

REC_OPS_NEW_KEYS = (
    "worksafebc-chlorine-toxic-process-gas",
    "worksafebc-chloramines-indoor-pools",
    "bc-guidelines-pool-design-operations",
    "bcrpa-poolsafebc-best-practices",
)


def test_interior_health_worksafebc_and_building_cards() -> None:
    catalog = cards_by_key()
    for key in REC_OPS_ENRICHED_KEYS + REC_OPS_NEW_KEYS:
        assert key in catalog, key
        card = catalog[key]
        assert card["review_date"] == "2026-09-16", key
        blob = f"{card['summary']} {card['applicability']}".lower()
        assert "you must by law" not in blob
        assert "pulse determines" not in blob

    assert "not legal advice" in DISCLAIMER.lower()

    ih = catalog["interior-health-recreational-water"]
    assert ih["official_source_url"] == IH_REC_WATER_PERMITS
    assert ih["topic_category"] == "Interior Health / Pools"
    assert "engineeringdirect" in ih["summary"].lower()
    assert "ephdirect" in ih["summary"].lower()
    assert "ice" in ih["applicability"].lower()
    assert "arena" in ih["applicability"].lower()

    pool_reg = catalog["bc-pool-regulation"]
    assert pool_reg["official_source_url"] == POOL_REG_BC_LAWS
    assert "s. 5" in pool_reg["summary"]
    assert "pool safety plan" in pool_reg["summary"].lower()
    assert "ice arenas are not pools" in pool_reg["applicability"].lower()

    chemistry = catalog["pool-chemistry-public-health-angle"]
    assert chemistry["official_source_url"] == POOL_REG_BC_LAWS
    assert "schedule 3" in chemistry["summary"].lower()
    assert "0.35" not in chemistry["summary"]  # airborne number belongs on the chloramines card

    ohs = catalog["worksafebc-ohs-how-to-look-up"]
    assert ohs["official_source_url"] == WSBC_OHS_SEARCHABLE
    assert "6.116" in ohs["summary"]
    assert "5.54" in ohs["summary"]

    whmis = catalog["worksafebc-whmis-chemicals"]
    assert whmis["official_source_url"] == WSBC_WHMIS
    assert "sds" in whmis["summary"].lower()

    ammonia = catalog["worksafebc-ammonia-refrigeration"]
    assert ammonia["official_source_url"] == WSBC_AMMONIA_GUIDE
    assert "ice rink" in f"{ammonia['applicability']} {ammonia['summary']}".lower()
    assert "6.116" in ammonia["summary"]

    building = catalog["bc-building-code-how-it-applies"]
    assert building["official_source_url"] == BC_CODES
    assert "part 3" in building["summary"].lower()
    assert "power-operated" in building["summary"].lower()
    # Do not invent unverified Building Code article numbers on this public-pointer card.
    assert "3.8.2.3" not in building["summary"]

    fire = catalog["bc-fire-code-and-vernon-fire-bylaw"]
    assert "5635" in fire["regulation_name"] or "5635" in fire["official_source_name"]
    assert "existing buildings" in fire["summary"].lower()

    chlorine = catalog["worksafebc-chlorine-toxic-process-gas"]
    assert chlorine["official_source_url"] == WSBC_CHLORINE_ADVISORY
    assert chlorine["topic_category"] == "OH&S"
    assert "6.116" in chlorine["summary"]
    assert "public swimming" in f"{chlorine['summary']} {chlorine['applicability']}".lower()

    chloramines = catalog["worksafebc-chloramines-indoor-pools"]
    assert chloramines["official_source_url"] == WSBC_CHLORAMINES_ARTICLE
    assert "0.35" in chloramines["summary"]
    assert "no occupational exposure limit" in chloramines["summary"].lower()

    moh = catalog["bc-guidelines-pool-design-operations"]
    assert moh["official_source_url"] == MOH_REC_WATER
    assert moh["classification"] == "Regulator guidance"
    assert "not a substitute" in f"{moh['applicability']} {moh['summary']}".lower()

    poolsafe = catalog["bcrpa-poolsafebc-best-practices"]
    assert poolsafe["official_source_url"] == BCRPA_POOLSAFE_RESOURCES
    assert poolsafe["classification"] == "Best practice"
    assert "not law" in poolsafe["regulation_name"].lower() or "not a statute" in poolsafe["summary"].lower()


def test_rec_ops_official_urls_are_live_https() -> None:
    """GET official source URLs for the rec-ops enrichment set.

    401/403/405 from a CDN still counts as a live host. Connection failures fail the test.
    """
    import urllib.error
    import urllib.request

    catalog = cards_by_key()
    failures: list[str] = []
    for key in REC_OPS_ENRICHED_KEYS + REC_OPS_NEW_KEYS:
        url = catalog[key]["official_source_url"]
        req = urllib.request.Request(
            url,
            method="GET",
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; PulseCatalogCheck/1.0)",
                "Accept": "text/html,application/pdf,*/*",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                status = getattr(resp, "status", 200)
                if status >= 400 and status not in {401, 403, 405}:
                    failures.append(f"{key}: {url} -> HTTP {status}")
        except urllib.error.HTTPError as exc:
            if exc.code not in {401, 403, 405}:
                failures.append(f"{key}: {url} -> HTTP {exc.code}")
        except Exception as exc:  # noqa: BLE001 — live citation check
            failures.append(f"{key}: {url} -> {exc}")
    assert not failures, "\n".join(failures)
