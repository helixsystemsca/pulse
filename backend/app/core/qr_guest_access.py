"""Guest read-only permission checks for QR-resolved resources."""

from __future__ import annotations

from typing import Any

# Fields/actions blocked for guest read-only sessions.
GUEST_BLOCKED_ACTIONS = frozenset(
    {
        "create",
        "edit",
        "delete",
        "issue_inventory",
        "receive_inventory",
        "generate_reorder_package",
        "view_costs",
        "view_vendors",
        "view_purchase_history",
        "view_internal_notes",
    }
)

# Response field prefixes/names stripped from guest payloads.
GUEST_REDACTED_FIELD_NAMES = frozenset(
    {
        "unit_cost",
        "estimated_unit_cost",
        "estimated_cost",
        "vendor",
        "vendor_part_number",
        "purchase_history",
        "internal_notes",
        "notes",
        "cost",
        "total_cost",
    }
)


def guest_mode_from_query(query_guest: str | None) -> bool:
    if not query_guest:
        return False
    return query_guest.strip().lower() in ("1", "true", "yes", "guest")


def is_guest_read_only_enabled(guest_access_enabled: bool, guest_access_level: str) -> bool:
    return bool(guest_access_enabled) and guest_access_level == "read_only"


def guest_may_perform(action: str) -> bool:
    return action not in GUEST_BLOCKED_ACTIONS


def redact_guest_payload(data: dict[str, Any]) -> dict[str, Any]:
    """Remove cost/vendor/note fields from a guest-visible resource payload."""
    out: dict[str, Any] = {}
    for key, value in data.items():
        lower = key.lower()
        if lower in GUEST_REDACTED_FIELD_NAMES:
            continue
        if isinstance(value, dict):
            out[key] = redact_guest_payload(value)
        elif isinstance(value, list):
            out[key] = [
                redact_guest_payload(item) if isinstance(item, dict) else item for item in value
            ]
        else:
            out[key] = value
    return out
