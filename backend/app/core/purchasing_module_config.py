"""Tenant purchasing module settings (stored in inventory_module_settings.settings.purchasing)."""

from __future__ import annotations

from typing import Any, Optional

DEFAULT_PURCHASING: dict[str, Any] = {
    "enabled": True,
    "enable_replenishment_requests": True,
    "enable_quick_purchases": True,
    "enable_receipt_uploads": True,
    "enable_vendor_tracking": True,
    "enable_contract_archive": False,
    "enable_purchase_history": True,
    "enable_monthly_expense_exports": True,
    "require_vendor_selection": False,
    "require_receipt_upload": False,
    "purchasing_label": "Purchasing",
    "replenishment_label": "Replenishment Queue",
}


def merge_purchasing_settings(raw: Optional[dict[str, Any]]) -> dict[str, Any]:
    out = dict(DEFAULT_PURCHASING)
    if not isinstance(raw, dict):
        return out
    for key in out:
        if key in raw:
            out[key] = raw[key]
    if isinstance(out.get("purchasing_label"), str):
        label = str(out["purchasing_label"]).strip()
        out["purchasing_label"] = label or DEFAULT_PURCHASING["purchasing_label"]
    if isinstance(out.get("replenishment_label"), str):
        rl = str(out["replenishment_label"]).strip()
        out["replenishment_label"] = rl or DEFAULT_PURCHASING["replenishment_label"]
    out["enabled"] = bool(out.get("enabled", True))
    for flag in (
        "enable_replenishment_requests",
        "enable_quick_purchases",
        "enable_receipt_uploads",
        "enable_vendor_tracking",
        "enable_contract_archive",
        "enable_purchase_history",
        "enable_monthly_expense_exports",
        "require_vendor_selection",
        "require_receipt_upload",
    ):
        if flag in raw:
            out[flag] = bool(raw[flag])
    if not out["enable_replenishment_requests"] and not out["enable_quick_purchases"]:
        out["enable_quick_purchases"] = True
    return out
