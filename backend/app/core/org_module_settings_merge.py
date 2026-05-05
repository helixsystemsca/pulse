"""Defaults and merge for per-organization module settings (`pulse_org_module_settings`)."""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Optional

DEFAULT_ORG_MODULE_SETTINGS: dict[str, Any] = {
    "workRequests": {
        "requirePhotoOnClose": False,
        "autoAssignTechnician": False,
        "enablePriorityLevels": True,
        "lockAfterCompletion": False,
        "allowManualOverride": True,
        "workItemCodePrefixIssue": "ISS",
        "workItemCodePrefixPreventative": "PM",
        "workItemCodePrefixSetup": "SET",
    },
    "schedule": {
        "allowShiftOverrides": True,
        "enforceMaxHours": 0,
        "autoGenerateShifts": False,
        # Custom staffing / coverage validation rules (UI-managed; evaluated client-side).
        "coverageRules": [],
        # Optional: enable the night-shift assignments panel in the day view.
        "enableNightAssignments": False,
        # How many physical facilities appear on the schedule (not equipment/zone maps).
        "facilityCount": 1,
        # Optional custom labels, same length as facilityCount (extra entries ignored, missing use "Facility n").
        "facilityLabels": [],
    },
    "assets": {
        "requireSerialNumber": False,
        "enableMaintenanceHistory": True,
        "allowAssetHierarchy": True,
    },
    "blueprint": {
        "enableSnapping": True,
        "showGrid": True,
        "enableAutoConnect": True,
    },
    "compliance": {
        "requireManagerForEscalation": False,
        "showRepeatOffenderHighlight": True,
        "strictReviewDeadlines": False,
    },
}


def _deep_merge(base: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    out = dict(base)
    for k, v in patch.items():
        if k in out and isinstance(out[k], dict) and isinstance(v, dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def merge_org_module_settings(stored: Optional[dict[str, Any]]) -> dict[str, Any]:
    root = deepcopy(DEFAULT_ORG_MODULE_SETTINGS)
    if not stored:
        return root
    return _deep_merge(root, stored)
