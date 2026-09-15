"""OpsAsk intent router — map free-text questions onto the regulatory library and Copilot prompts.

Deterministic. Not an LLM. Never claims a Pulse summary is legally required.
"""

from __future__ import annotations

from typing import Any, Optional

from app.core.regulatory_reference_catalog import (
    DISCLAIMER,
    INTENT_SYNONYMS,
    INTENT_TO_CARD_KEYS,
    LIBRARY_HREF,
    REFERENCE_CARDS,
    cards_by_key,
)

# Copilot prompt ids that should also surface when an intent matches.
INTENT_TO_COPILOT: dict[str, str] = {
    "emergency_ammonia": "ammonia-release",
    "interior_health_pools": "pool-emergency",
    "chief_engineer": "qualified-ice-plant",
    "refrigeration_plant": "qualified-ice-plant",
}


def normalize_query(raw: str) -> str:
    q = (raw or "").strip().lower().replace("&", " and ")
    q = q.replace("oh and s", "ohs")
    return " ".join(q.split())


def match_intents(query: str) -> list[str]:
    q = normalize_query(query)
    if not q:
        return []
    hits: list[str] = []
    for intent, phrases in INTENT_SYNONYMS:
        if any(p in q for p in phrases):
            hits.append(intent)
    return hits


def match_card_keys(query: str) -> list[str]:
    q = normalize_query(query)
    if not q:
        return []
    keys: list[str] = []
    seen: set[str] = set()
    for intent in match_intents(q):
        for key in INTENT_TO_CARD_KEYS.get(intent, ()):
            if key not in seen:
                seen.add(key)
                keys.append(key)
    catalog = cards_by_key()
    # Direct keyword / title hits even without a named intent.
    for card in REFERENCE_CARDS:
        key = card["key"]
        hay = " ".join(
            [
                card["title"],
                card.get("topic_category") or "",
                " ".join(card.get("keywords") or []),
            ]
        ).lower()
        if key in seen:
            continue
        if q in hay or any(tok and tok in hay for tok in q.split() if len(tok) > 3):
            # Prefer stronger overlap: at least one catalog keyword in the query, or title fragment.
            keywords = [k.lower() for k in (card.get("keywords") or [])]
            title = card["title"].lower()
            if any(k in q for k in keywords) or any(part in q for part in title.split() if len(part) > 4):
                seen.add(key)
                keys.append(key)
    return keys


def route_ops_ask(query: str) -> dict[str, Any]:
    """Return a structured routing result for Copilot / search."""
    q = (query or "").strip()
    intents = match_intents(q)
    card_keys = match_card_keys(q)
    copilot_id: Optional[str] = None
    for intent in intents:
        if intent in INTENT_TO_COPILOT:
            copilot_id = INTENT_TO_COPILOT[intent]
            break
    cards = [cards_by_key()[k] for k in card_keys if k in cards_by_key()]
    library_q = q or None
    href = LIBRARY_HREF
    if card_keys:
        href = f"{LIBRARY_HREF}?q={_url_query(q)}" if q else LIBRARY_HREF
    return {
        "query": q,
        "intents": intents,
        "card_keys": card_keys,
        "copilot_prompt_id": copilot_id,
        "library_href": href,
        "disclaimer": DISCLAIMER,
        "cards": [
            {
                "key": c["key"],
                "title": c["title"],
                "topic_category": c["topic_category"],
                "classification": c["classification"],
                "summary": c["summary"],
                "official_source_name": c["official_source_name"],
                "official_source_url": c["official_source_url"],
                "href": f"{LIBRARY_HREF}?q={_url_query(c['title'])}",
            }
            for c in cards
        ],
        "library_query": library_q,
    }


def format_library_answer(route: dict[str, Any]) -> str:
    cards = route.get("cards") or []
    if not cards:
        return (
            "No matching Codes & Guidance cards for that wording yet. "
            f"Open the regulatory library at {LIBRARY_HREF} and search by category. "
            "Pulse will not invent a legal requirement."
        )
    lines = [
        "Codes & Guidance (reference only — not a legal determination):",
        "",
    ]
    for c in cards[:6]:
        lines.append(f"• {c['title']} [{c['classification']} / {c['topic_category']}]")
        lines.append(f"  {c['summary']}")
        lines.append(f"  Official source: {c['official_source_name']} — {c['official_source_url']}")
        lines.append("")
    lines.append(DISCLAIMER)
    return "\n".join(lines).strip()


def _url_query(text: str) -> str:
    from urllib.parse import quote

    return quote(text or "", safe="")
