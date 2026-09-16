"""Vernon starter seed is tenant-scoped, placeholder contractors, no fake staff."""

from app.core.vernon_starter_seed import FACILITIES, INTERNAL_NOTE, PROCEDURES, SEED_TAG
from app.core.regulatory_reference_catalog import REFERENCE_CARDS


def test_vernon_facilities_and_internal_disclaimer() -> None:
    titles = {f["title"] for f in FACILITIES}
    assert "Vernon Civic Arena" in titles
    assert "Vernon Aquatic Centre" in titles
    assert "Vernon Community Recreation Centre" in titles
    assert "not a regulatory citation" in INTERNAL_NOTE.lower()
    assert SEED_TAG == "vernon-starter"


def test_emergency_procedures_are_internal() -> None:
    titles = {p["title"] for p in PROCEDURES}
    assert "Ammonia release — internal response" in titles
    assert "Drowning / pool emergency — internal response" in titles
    for p in PROCEDURES:
        assert "internal" in p["title"].lower()


def test_regulatory_reference_seed_catalog_is_tenant_safe() -> None:
    keys = [c["key"] for c in REFERENCE_CARDS]
    assert "chief-engineer-plant-responsibility" in keys
    assert "tsbc-ammonia-public-occupancy" in keys
    assert "tsbc-general-supervision-risk-assessed" in keys
    assert "tsbc-ammonia-safety-awareness" in keys
    assert "tsbc-refrigeration-operator-certificate" in keys
    assert "tsbc-ice-facility-operator-certificate" in keys
    assert "pebpvrsr-chief-engineer-definition-duties" in keys
    assert "tsbc-secondary-coolant-overpressure" in keys
    assert "tsbc-refrigeration-design-registration" in keys
    assert "interior-health-recreational-water" in keys
    assert "bc-pool-regulation" in keys
    assert "worksafebc-chlorine-toxic-process-gas" in keys
    assert "worksafebc-chloramines-indoor-pools" in keys
    assert "bc-guidelines-pool-design-operations" in keys
    assert "bcrpa-poolsafebc-best-practices" in keys
    assert "bc-building-code-how-it-applies" in keys
    for card in REFERENCE_CARDS:
        assert "pulse_pointers" in card
        assert not card["summary"].lower().startswith("you are legally required")
        hrefs = [p.get("href") for p in card["pulse_pointers"] if p.get("href")]
        if card["key"].startswith("tsbc-") or card["key"] == "chief-engineer-plant-responsibility":
            assert hrefs, card["key"]


def test_vernon_starter_pack_does_not_auto_insert_guidance_cards() -> None:
    """Josh enters Codes & Guidance as he learns — startup must not push catalog rows."""
    import inspect

    from app.core.vernon_starter_seed import seed_vernon_starter_pack

    src = inspect.getsource(seed_vernon_starter_pack)
    assert "seed_regulatory_reference_cards" not in src
    assert "REFERENCE_CARDS" not in src
