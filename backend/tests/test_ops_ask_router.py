"""OpsAsk intent router lands regulatory questions on the library catalog."""

from app.services.ops_ask_router import match_intents, route_ops_ask


def test_example_questions_route_to_library() -> None:
    cases = {
        "chief engineer responsibilities": "chief_engineer",
        "interior health pool code": "interior_health_pools",
        "building code": "building_code",
        "oh&s": "ohs",
        "refrigeration plant requirements": "refrigeration_plant",
        "refrigeration operator certificate": "chief_engineer",
        "ammonia safety awareness": "refrigeration_plant",
        "general supervision": "refrigeration_plant",
        "ammonia": "refrigeration_plant",
        "tsbc": "refrigeration_plant",
        "ice plant": "refrigeration_plant",
        "secondary coolant": "refrigeration_plant",
        "chief engineer definition": "chief_engineer",
    }
    for query, intent in cases.items():
        route = route_ops_ask(query)
        assert intent in route["intents"], query
        assert route["card_keys"], query
        assert "/recreation/regulations" in route["library_href"]
        assert route["cards"]
        assert "not legal advice" in route["disclaimer"].lower() or "not a municipal" in route["disclaimer"].lower()


def test_tsbc_safety_order_and_certificate_queries_hit_new_cards() -> None:
    occupancy = route_ops_ask("ammonia refrigeration plants in public occupancies safety order")
    assert "tsbc-ammonia-public-occupancy" in occupancy["card_keys"]
    absence = route_ops_ask("temporary absence of chief engineer")
    assert "chief-engineer-plant-responsibility" in absence["card_keys"]
    ro = route_ops_ask("refrigeration operator certificate")
    assert "tsbc-refrigeration-operator-certificate" in ro["card_keys"]
    ifo = route_ops_ask("ice facility operator certificate")
    assert "tsbc-ice-facility-operator-certificate" in ifo["card_keys"]
    special = route_ops_ask("risk assessed plant registration MAN-4000")
    assert "tsbc-general-supervision-risk-assessed" in special["card_keys"]
    duties = route_ops_ask("chief engineer definition section 68")
    assert "pebpvrsr-chief-engineer-definition-duties" in duties["card_keys"]
    classify = route_ops_ask("refrigeration plant A3 B2L in charge")
    assert "pebpvrsr-refrigeration-in-charge-classification" in classify["card_keys"]
    coolant = route_ops_ask("secondary coolant overpressure")
    assert "tsbc-secondary-coolant-overpressure" in coolant["card_keys"]
    design = route_ops_ask("refrigeration plant design registration")
    assert "tsbc-refrigeration-design-registration" in design["card_keys"]


def test_ohs_synonym_and_empty_query() -> None:
    assert "ohs" in match_intents("OH&S recreation")
    empty = route_ops_ask("   ")
    assert empty["intents"] == []
    assert empty["card_keys"] == []
