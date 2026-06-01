"""Parse and merge company-level operational notification settings."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Optional

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@dataclass(frozen=True)
class InventoryLowStockAlertConfig:
    enabled: bool
    emails: list[str]


def _parse_email_list(raw: Any) -> list[str]:
    if raw is None:
        return []
    if isinstance(raw, list):
        parts = [str(x).strip() for x in raw]
    else:
        text = str(raw).replace(";", ",").replace("\n", ",")
        parts = [p.strip() for p in text.split(",")]
    out: list[str] = []
    seen: set[str] = set()
    for p in parts:
        if not p or p in seen:
            continue
        if _EMAIL_RE.match(p):
            out.append(p)
            seen.add(p)
    return out


def inventory_low_stock_from_company(stored: Optional[dict[str, Any]]) -> InventoryLowStockAlertConfig:
    root = stored if isinstance(stored, dict) else {}
    inv = root.get("inventory_low_stock")
    if not isinstance(inv, dict):
        return InventoryLowStockAlertConfig(enabled=False, emails=[])
    enabled = bool(inv.get("enabled", False))
    emails = _parse_email_list(inv.get("emails") or inv.get("email"))
    return InventoryLowStockAlertConfig(enabled=enabled, emails=emails)


def patch_inventory_low_stock(
    stored: Optional[dict[str, Any]],
    *,
    enabled: Optional[bool] = None,
    emails: Optional[str | list[str]] = None,
) -> dict[str, Any]:
    root = dict(stored) if isinstance(stored, dict) else {}
    inv = dict(root.get("inventory_low_stock") or {})
    if enabled is not None:
        inv["enabled"] = bool(enabled)
    if emails is not None:
        inv["emails"] = ", ".join(_parse_email_list(emails))
    root["inventory_low_stock"] = inv
    return root


def inventory_low_stock_to_api(cfg: InventoryLowStockAlertConfig) -> dict[str, Any]:
    return {
        "enabled": cfg.enabled,
        "emails": ", ".join(cfg.emails),
        "email_list": cfg.emails,
    }
