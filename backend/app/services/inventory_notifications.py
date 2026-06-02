"""Inventory notification contacts from module settings JSON."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Optional

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def parse_email_list(raw: Any) -> list[str]:
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
        e = p.strip().lower()
        if not e or e in seen or not _EMAIL_RE.match(e):
            continue
        out.append(e)
        seen.add(e)
    return out


@dataclass(frozen=True)
class InventoryNotificationsConfig:
    email_directory: list[str]
    low_stock_enabled: bool
    low_stock_emails: list[str]
    mr_export_emails: list[str]


def notifications_from_settings(settings: Optional[dict[str, Any]]) -> InventoryNotificationsConfig:
    root = settings if isinstance(settings, dict) else {}
    block = root.get("notifications")
    if not isinstance(block, dict):
        return InventoryNotificationsConfig(
            email_directory=[],
            low_stock_enabled=True,
            low_stock_emails=[],
            mr_export_emails=[],
        )
    directory = parse_email_list(block.get("email_directory"))
    dir_set = set(directory)

    def _subset(key: str) -> list[str]:
        raw = block.get(key)
        if raw is None:
            return list(directory)
        return [e for e in parse_email_list(raw) if e in dir_set]

    return InventoryNotificationsConfig(
        email_directory=directory,
        low_stock_enabled=block.get("low_stock_enabled", True) is not False,
        low_stock_emails=_subset("low_stock_emails"),
        mr_export_emails=_subset("mr_export_emails"),
    )
