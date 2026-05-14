"""Default and merge helper for `PulseWorkersSettings.settings` JSON (shared with auth/feature resolution)."""

from __future__ import annotations

import copy
from typing import Any, Optional

from app.core.features.system_catalog import GLOBAL_SYSTEM_FEATURES
from app.core.permission_feature_matrix import sanitize_department_role_feature_access

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
        {"key": "afternoon", "label": "Afternoon shift"},
        {"key": "night", "label": "Night shift"},
        {"key": "auxiliary", "label": "Auxiliary"},
        {"key": "custom", "label": "Custom"},
    ],
    "skill_categories": ["Welding", "Electrical", "HVAC", "Safety"],
    "certification_rules": [],
    #: Company admin delegates access to the Workers & Roles product page (not system-admin contract).
    "workers_page_delegation": {"manager": False, "supervisor": False, "lead": False},
    #: Company admin: which operational roles may edit downstream `role_feature_access` from Team Management.
    "permission_delegation": {"manager": False, "supervisor": False, "lead": False},
    #: When true, delegated managers/supervisors/leads may set `feature_allow_extra` on worker-role roster users.
    "delegates_can_assign_worker_module_extras": False,
    #: Optional per-role product modules (keys in GLOBAL_SYSTEM_FEATURES). Missing role key => full contract.
    "role_feature_access": {},
    #: Department × permission-slot matrix (GLOBAL_SYSTEM_FEATURES keys). Empty => use role_feature_access only.
    "department_role_feature_access": {},
    #: Roles (JWT `users.roles`) that may PATCH work requests (assignee, zone, due date, etc.). Company admins always can.
    "work_request_edit_roles": ["manager", "supervisor"],
    #: Roles that may add/rename/delete facility zones (work-request locations). Company admins always can.
    "zone_manage_roles": ["manager", "supervisor"],
}


def _merge_keyed_list(
    defaults: list[dict[str, Any]],
    raw: Any,
    *,
    key_field: str = "key",
) -> list[dict[str, Any]]:
    """
    Merge a list of dicts (e.g. shifts/roles) by a stable key.

    - Preserve default ordering for known keys
    - Overlay raw items onto matching defaults (so labels can be customized)
    - Append any extra raw items not present in defaults
    """

    if not isinstance(raw, list):
        return defaults

    raw_items: list[dict[str, Any]] = [x for x in raw if isinstance(x, dict) and x.get(key_field)]
    raw_by_key: dict[str, dict[str, Any]] = {str(x[key_field]): x for x in raw_items}

    out: list[dict[str, Any]] = []
    seen: set[str] = set()

    for d in defaults:
        k = d.get(key_field)
        if not k:
            continue
        ks = str(k)
        seen.add(ks)
        merged = dict(d)
        merged.update(raw_by_key.get(ks, {}))
        out.append(merged)

    for x in raw_items:
        ks = str(x[key_field])
        if ks in seen:
            continue
        out.append(dict(x))
        seen.add(ks)

    return out


def _sanitize_feature_key_list(v: object) -> list[str]:
    cat = set(GLOBAL_SYSTEM_FEATURES)
    if not isinstance(v, list):
        return []
    return sorted({str(x) for x in v if str(x) in cat})


def sanitize_workers_policy_keys(base: dict[str, Any]) -> None:
    """Coerce policy JSON fields to expected shapes (guards `.get` on dict-only keys)."""
    rfa = base.get("role_feature_access")
    if isinstance(rfa, dict):
        allowed_roles = frozenset({"manager", "supervisor", "lead", "worker"})
        out: dict[str, list[str]] = {}
        for k, v in rfa.items():
            if str(k) in allowed_roles:
                out[str(k)] = _sanitize_feature_key_list(v)
        base["role_feature_access"] = out
    else:
        base["role_feature_access"] = {}

    pm = base.get("permission_matrix")
    if not isinstance(pm, dict):
        base["permission_matrix"] = copy.deepcopy(DEFAULT_WORKERS_SETTINGS["permission_matrix"])

    base["department_role_feature_access"] = sanitize_department_role_feature_access(
        base.get("department_role_feature_access")
    )

    wpd = base.get("workers_page_delegation")
    if isinstance(wpd, dict):
        base["workers_page_delegation"] = {
            "manager": bool(wpd.get("manager")),
            "supervisor": bool(wpd.get("supervisor")),
            "lead": bool(wpd.get("lead")),
        }
    else:
        base["workers_page_delegation"] = dict(DEFAULT_WORKERS_SETTINGS["workers_page_delegation"])

    pdel = base.get("permission_delegation")
    if isinstance(pdel, dict):
        base["permission_delegation"] = {
            "manager": bool(pdel.get("manager")),
            "supervisor": bool(pdel.get("supervisor")),
            "lead": bool(pdel.get("lead")),
        }
    else:
        base["permission_delegation"] = dict(DEFAULT_WORKERS_SETTINGS["permission_delegation"])

    if "delegates_can_assign_worker_module_extras" in base:
        base["delegates_can_assign_worker_module_extras"] = bool(
            base.get("delegates_can_assign_worker_module_extras")
        )


def merge_workers_settings(raw: Optional[dict[str, Any]]) -> dict[str, Any]:
    out = copy.deepcopy(DEFAULT_WORKERS_SETTINGS)
    if not raw:
        sanitize_workers_policy_keys(out)
        return out
    for k, v in raw.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            merged = dict(out[k])
            merged.update(v)
            out[k] = merged
        elif k in ("roles", "shifts") and isinstance(out.get(k), list):
            out[k] = _merge_keyed_list(out[k], v)  # type: ignore[arg-type]
        else:
            out[k] = v
    sanitize_workers_policy_keys(out)
    return out
