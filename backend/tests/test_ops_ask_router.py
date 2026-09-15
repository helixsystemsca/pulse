"""OpsAsk intent router lands regulatory questions on the library catalog."""

from app.services.ops_ask_router import match_intents, route_ops_ask


def test_example_questions_route_to_library() -> None:
    cases = {
        "chief engineer responsibilities": "chief_engineer",
        "interior health pool code": "interior_health_pools",
        "building code": "building_code",
        "oh&s": "ohs",
        "refrigeration plant requirements": "refrigeration_plant",
    }
    for query, intent in cases.items():
        route = route_ops_ask(query)
        assert intent in route["intents"], query
        assert route["card_keys"], query
        assert "/recreation/regulations" in route["library_href"]
        assert route["cards"]
        assert "not legal advice" in route["disclaimer"].lower() or "not a municipal" in route["disclaimer"].lower()


def test_ohs_synonym_and_empty_query() -> None:
    assert "ohs" in match_intents("OH&S recreation")
    empty = route_ops_ask("   ")
    assert empty["intents"] == []
    assert empty["card_keys"] == []
