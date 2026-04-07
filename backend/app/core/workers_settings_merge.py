"""Default and merge helper for `PulseWorkersSettings.settings` JSON (shared with auth/feature resolution)."""

from __future__ import annotations

import copy
from typing import Any, Optional

DEFAULT_WORKERS_SETTINGS: dict[str, Any] = {
    "permission_matrix": {
        "view_tools": True,
        "assign_jobs": True,
        "manage_inventory": False,
        "manage_work_requests": True,
        "view_reports": True,
    },
    "roles": [
        {"key": "company_admin", "label": "Company Admin"},
        {"key": "manager", "label": "Manager"},
        {"key": "supervisor", "label": "Supervisor"},
        {"key": "lead", "label": "Lead"},
        {"key": "worker", "label": "Worker"},
    ],
    "shifts": [
        {"key": "day", "label": "Day shift"},
        {"key": "night", "label": "Night shift"},
        {"key": "custom", "label": "Custom"},
    ],
    "skill_categories": ["Welding", "Electrical", "HVAC", "Safety"],
    "certification_rules": [],
    #: Company admin delegates access to the Workers & Roles product page (not system-admin contract).
    "workers_page_delegation": {"manager": False, "supervisor": False, "lead": False},
    #: Optional per-role product modules (keys in GLOBAL_SYSTEM_FEATURES). Missing role key => full contract.
    "role_feature_access": {},
}


def merge_workers_settings(raw: Optional[dict[str, Any]]) -> dict[str, Any]:
    out = copy.deepcopy(DEFAULT_WORKERS_SETTINGS)
    if not raw:
        return out
    for k, v in raw.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            merged = dict(out[k])
            merged.update(v)
            out[k] = merged
        else:
            out[k] = v
    return out
