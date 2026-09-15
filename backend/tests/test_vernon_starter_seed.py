"""Vernon starter seed is tenant-scoped, placeholder contractors, no fake staff."""

from app.core.vernon_starter_seed import FACILITIES, INTERNAL_NOTE, PROCEDURES, SEED_TAG


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
