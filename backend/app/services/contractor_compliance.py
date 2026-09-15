"""Contractor insurance / WCB / ticket expiry highlighting."""

from __future__ import annotations

from datetime import date
from typing import Any, Optional

from app.services.ops_compliance_dates import as_date, classify_expiry, days_until, is_attention


def _ticket_rows(raw: Any) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    if not isinstance(raw, list):
        return out
    for item in raw:
        if isinstance(item, str):
            name = item.strip()
            if not name:
                continue
            out.append({"name": name, "expiry": None, "number": None})
            continue
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or item.get("title") or item.get("ticket") or "").strip()
        if not name:
            continue
        out.append(
            {
                "name": name,
                "number": (str(item.get("number") or item.get("ticket_number") or "").strip() or None),
                "expiry": as_date(item.get("expiry") or item.get("expiry_date")),
            }
        )
    return out


def contractor_compliance(row: Any, *, today: Optional[date] = None) -> dict[str, Any]:
    alerts: list[dict[str, Any]] = []

    def add(kind: str, label: str, expiry: Optional[date], *, missing_ok: bool = False) -> str:
        status = classify_expiry(expiry, today=today)
        if status == "missing" and missing_ok:
            return status
        if is_attention(status):
            remaining = days_until(expiry, today=today)
            alerts.append(
                {
                    "kind": kind,
                    "label": label,
                    "status": status,
                    "expiry": expiry.isoformat() if expiry else None,
                    "days": remaining,
                }
            )
        return status

    ins = add("insurance", "Insurance / COI", as_date(getattr(row, "insurance_expiry", None)))
    wcb = add("wcb", "WCB / WorkSafeBC", as_date(getattr(row, "wcb_expiry", None)))
    ticket_alerts: list[dict[str, Any]] = []
    for t in _ticket_rows(getattr(row, "tickets", None)):
        status = classify_expiry(t["expiry"], today=today)
        if is_attention(status) and status != "missing":
            ticket_alerts.append(
                {
                    "kind": "ticket",
                    "label": t["name"],
                    "status": status,
                    "expiry": t["expiry"].isoformat() if t["expiry"] else None,
                    "days": days_until(t["expiry"], today=today),
                }
            )
    alerts.extend(ticket_alerts)

    worst = "ok"
    rank = {"expired": 0, "expiring_30": 1, "expiring_60": 2, "expiring_90": 3, "missing": 4, "ok": 5}
    for a in alerts:
        if rank.get(str(a["status"]), 9) < rank.get(worst, 9):
            worst = str(a["status"])
    if ins == "missing" or wcb == "missing":
        if worst == "ok":
            worst = "missing"

    return {
        "insurance_status": ins,
        "wcb_status": wcb,
        "overall_status": worst,
        "alerts": alerts,
        "has_attention": bool(alerts),
    }
