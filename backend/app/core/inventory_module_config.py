"""Tenant inventory module config (wizard settings under settings.inventory)."""

from __future__ import annotations

from typing import Any, Literal, Optional

InventoryReferenceMode = Literal["none", "optional", "required"]
InventoryLocationMode = Literal["single", "rooms", "buildings", "seacans", "custom"]

DEFAULT_INVENTORY_BLOCK: dict[str, Any] = {
    "asset_types": ["consumables", "tools", "materials"],
    "location_mode": "single",
    "procurement_mode": "excel",
    "procurement_action_label": "Export Request",
    "reference_mode": "none",
    "approval_mode": "none",
}


def merge_inventory_block(raw: Optional[dict[str, Any]]) -> dict[str, Any]:
    out = dict(DEFAULT_INVENTORY_BLOCK)
    if not isinstance(raw, dict):
        return out
    if isinstance(raw.get("asset_types"), list) and raw["asset_types"]:
        out["asset_types"] = [str(x) for x in raw["asset_types"] if str(x).strip()]
    for key in ("location_mode", "procurement_mode", "procurement_action_label", "reference_mode", "approval_mode"):
        if raw.get(key):
            out[key] = raw[key]
    label = str(out.get("procurement_action_label") or "").strip()
    out["procurement_action_label"] = label or DEFAULT_INVENTORY_BLOCK["procurement_action_label"]
    return out


def reference_mode_from_transactions(transactions: dict[str, Any]) -> InventoryReferenceMode:
    if not transactions.get("enable_references"):
        return "none"
    if transactions.get("require_reference"):
        return "required"
    return "optional"


def resolve_reference_mode(settings: dict[str, Any]) -> InventoryReferenceMode:
    inv = settings.get("inventory")
    if isinstance(inv, dict) and inv.get("reference_mode") in ("none", "optional", "required"):
        return inv["reference_mode"]
    tx = settings.get("transactions")
    if isinstance(tx, dict):
        return reference_mode_from_transactions(tx)
    return "none"


def location_selection_enabled(settings: dict[str, Any]) -> bool:
    inv = settings.get("inventory")
    if isinstance(inv, dict) and inv.get("location_mode"):
        return str(inv["location_mode"]) != "single"
    tx = settings.get("transactions")
    if isinstance(tx, dict) and "enable_location_selection" in tx:
        return tx.get("enable_location_selection", True) is not False
    return True


def transaction_flags_from_settings(settings: dict[str, Any]) -> tuple[bool, bool, bool]:
    """Return enable_references, require_reference, enable_location_selection."""
    mode = resolve_reference_mode(settings)
    enable_refs = mode in ("optional", "required")
    require_ref = mode == "required"
    enable_loc = location_selection_enabled(settings)
    return enable_refs, require_ref, enable_loc
