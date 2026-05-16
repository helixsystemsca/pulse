"""
Cross-layer access audit: contract, enabled_features, RBAC bridge, and simulated UI gates.

Temporary observability — mirrors frontend rules in ``tenant-nav`` + ``session-access`` (documented in code).
Does not change authorization outcomes.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.access_debugger import compute_access_resolution_debug
from app.core.features.canonical_catalog import to_canonical_feature_key
from app.core.rbac.catalog import FEATURE_TO_RBAC_PERMISSIONS, RBAC_KEY_REQUIRES_COMPANY_FEATURE
from app.core.rbac.resolve import rbac_keys_from_legacy_effective_features
from app.core.user_roles import user_has_tenant_full_admin
from app.models.domain import User
from app.models.pulse_models import PulseWorkerHR
from app.models.rbac_models import TenantRole

# Mirrors ``frontend/config/platform/master-feature-registry.ts`` (nav-visible product modules).
_NAV_FEATURES: tuple[dict[str, Any], ...] = (
    {"registry_key": "dashboard", "feature": "dashboard", "route": "/overview", "rbac": ("dashboard.view",)},
    {"registry_key": "logs_inspections", "feature": "logs_inspections", "route": "/dashboard/compliance", "rbac": ("compliance.view",)},
    {"registry_key": "schedule", "feature": "schedule", "route": "/schedule", "rbac": ("schedule.view",)},
    {"registry_key": "monitoring", "feature": "monitoring", "route": "/monitoring", "rbac": ("monitoring.view",)},
    {"registry_key": "inventory", "feature": "inventory", "route": "/dashboard/inventory", "rbac": ("inventory.view",)},
    {"registry_key": "projects", "feature": "projects", "route": "/dashboard/projects", "rbac": ("projects.view",)},
    {"registry_key": "team_management", "feature": "team_management", "route": "/dashboard/workers", "rbac": ("team_management.view",)},
    {"registry_key": "comms_advertising_mapper", "feature": "advertising_mapper", "route": "/communications/advertising-mapper", "rbac": ("arena_advertising.view",), "contract": "comms_advertising_mapper"},
    {"registry_key": "comms_publication_builder", "feature": "comms_publication_builder", "route": "/communications/publication-builder", "rbac": ("publication_pipeline.view",)},
    {"registry_key": "xplor_indesign", "feature": "xplor_indesign", "route": "/communications/indesign-pipeline", "rbac": ("xplor_indesign.view",), "contract": "comms_indesign_pipeline"},
    {"registry_key": "comms_campaign_planner", "feature": "comms_campaign_planner", "route": "/communications/campaign-planner", "rbac": ("social_planner.view",)},
    {"registry_key": "comms_assets", "feature": "comms_assets", "route": "/communications/assets", "rbac": ("communications_assets.view",)},
)

# Flat RBAC keys with no wired FastAPI ``require_rbac_*`` today (comms + several modules).
_RBAC_KEYS_WITHOUT_API_ENFORCEMENT: frozenset[str] = frozenset(
    {
        "arena_advertising.view",
        "social_planner.view",
        "publication_pipeline.view",
        "xplor_indesign.view",
        "communications_assets.view",
        "messaging.view",
    }
)

_LEGACY_RBAC_TO_PLATFORM_CAPS: dict[str, tuple[str, ...]] = {
    "arena_advertising.view": ("communications.advertising_mapper.view",),
    "social_planner.view": ("communications.campaign_planner.view",),
    "publication_pipeline.view": ("publications.create", "publications.export"),
    "xplor_indesign.view": ("communications.indesign_pipeline.view",),
    "communications_assets.view": ("communications.assets.view",),
}


def _contract_set(names: list[str]) -> set[str]:
    out: set[str] = set()
    for n in names:
        out.add(str(n))
        c = to_canonical_feature_key(str(n))
        if c:
            out.add(c)
    return out


def _enabled_set(names: list[str]) -> set[str]:
    return {str(x) for x in names}


def _rbac_set(keys: list[str]) -> set[str]:
    return set(keys)


def _legacy_caps_from_rbac(rbac: set[str]) -> list[str]:
    if "*" in rbac:
        return sorted({c for caps in _LEGACY_RBAC_TO_PLATFORM_CAPS.values() for c in caps})
    out: set[str] = set()
    for k in rbac:
        for c in _LEGACY_RBAC_TO_PLATFORM_CAPS.get(k, ()):
            out.add(c)
    return sorted(out)


def _simulate_sidebar_visible(
    *,
    user: User,
    feature: str,
    contract: set[str],
    enabled: set[str],
    rbac: set[str],
) -> tuple[bool, list[str]]:
    notes: list[str] = []
    if user.is_system_admin:
        return True, ["system_admin bypass"]
    feat = feature
    canon = to_canonical_feature_key(feature) or feature
    on_contract = feat in contract or canon in contract
    if not on_contract:
        return False, ["not on tenant contract"]
    if user_has_tenant_full_admin(user):
        return True, ["tenant_full_admin bypass (contract only)"]
    if canon not in enabled and feat not in enabled:
        return False, ["not in enabled_features (matrix ∪ extras)"]
    return True, notes


def _simulate_route_allowed(
    *,
    user: User,
    feature: str,
    contract: set[str],
    enabled: set[str],
    rbac: set[str],
    rbac_required: tuple[str, ...],
) -> tuple[bool, list[str]]:
    notes: list[str] = []
    if user.is_system_admin:
        return True, ["system_admin bypass"]
    vis, vnotes = _simulate_sidebar_visible(user=user, feature=feature, contract=contract, enabled=enabled, rbac=rbac)
    notes.extend(vnotes)
    if not vis:
        return False, notes + ["route gate: enabled_features/contract failed"]
    if user_has_tenant_full_admin(user):
        return True, notes + ["tenant_full_admin bypass"]
    if rbac_required and "*" not in rbac:
        if not any(k in rbac for k in rbac_required):
            return False, notes + [f"missing RBAC anyOf: {list(rbac_required)}"]
    return True, notes


def _api_allowed_for_rbac_keys(rbac_required: tuple[str, ...], effective_rbac: set[str]) -> bool | None:
    if not rbac_required:
        return None
    if "*" in effective_rbac:
        return True
    if any(k in _RBAC_KEYS_WITHOUT_API_ENFORCEMENT for k in rbac_required):
        return None  # client-only module; no dedicated API guard in codebase today
    return all(k in effective_rbac for k in rbac_required)


@dataclass
class _AuditBundle:
    payload: dict[str, Any]


async def debug_resolved_access(
    *,
    db: AsyncSession,
    target: User,
    contract_normalized: list[str],
    merged_settings: dict[str, Any],
    hr_row: PulseWorkerHR | None,
    tenant_role: TenantRole | None,
    department_slug: str | None = None,
) -> dict[str, Any]:
    """
    Build a cross-layer audit for ``target``.

    ``department_slug`` is used for workspace_context only; sidebar simulation is global (matches SPA).
    """
    dbg = await compute_access_resolution_debug(
        db=db,
        target=target,
        contract_normalized=contract_normalized,
        merged_settings=merged_settings,
        hr_row=hr_row,
        tenant_role=tenant_role,
    )
    dbg_json = dbg.as_json()

    contract = _contract_set(contract_normalized)
    enabled = _enabled_set(dbg.effective_enabled_features)
    rbac_eff = _rbac_set(dbg.rbac_permission_keys)
    bridged = sorted(rbac_keys_from_legacy_effective_features(dbg.effective_enabled_features))

    assigned = list(target.roles or [])
    dept_roles: list[str] = []
    if dbg.resolved_slot:
        dept_roles.append(f"matrix_slot:{dbg.resolved_slot}")
    if dbg.resolved_slot_source:
        dept_roles.append(f"source:{dbg.resolved_slot_source}")
    if dbg.hr_matrix_slot:
        dept_roles.append(f"hr.matrix_slot={dbg.hr_matrix_slot}")

    org_roles: list[str] = []
    if tenant_role:
        org_roles.append(f"{tenant_role.slug}")
    elif dbg.tenant_role_slug:
        org_roles.append(str(dbg.tenant_role_slug))

    log: list[dict[str, Any]] = []
    visible: list[str] = []
    denied: list[str] = []

    for row in _NAV_FEATURES:
        feat = str(row["feature"])
        contract_key = str(row.get("contract") or feat)
        rbac_req = tuple(row.get("rbac") or ())
        sidebar_ok, s_notes = _simulate_sidebar_visible(
            user=target, feature=contract_key, contract=contract, enabled=enabled, rbac=rbac_eff
        )
        route_ok, r_notes = _simulate_route_allowed(
            user=target,
            feature=contract_key,
            contract=contract,
            enabled=enabled,
            rbac=rbac_eff,
            rbac_required=rbac_req,
        )
        api_ok = _api_allowed_for_rbac_keys(rbac_req, rbac_eff)
        render_ok = route_ok

        failure: str | None = None
        if not sidebar_ok:
            failure = "sidebar_hidden"
        elif not route_ok:
            failure = "route_denied"
        elif sidebar_ok and route_ok and rbac_req and "*" not in rbac_eff:
            if not any(k in rbac_eff for k in rbac_req):
                failure = "rbac_bridge_missing"

        entry = {
            "feature_key": feat,
            "registry_key": row.get("registry_key"),
            "route": row.get("route"),
            "rbac_keys_required": list(rbac_req),
            "sidebar_visible": sidebar_ok,
            "route_allowed": route_ok,
            "api_allowed": api_ok,
            "render_allowed": render_ok,
            "failure_reason": failure,
            "resolution_notes": s_notes + r_notes,
        }
        log.append(entry)
        if sidebar_ok and route_ok:
            visible.append(feat)
        else:
            denied.append(feat)

    # Department hub gate (matches ``buildDepartmentNavItems`` — any platform-icon sidebar row).
    dept_nav_count = sum(1 for e in log if e["sidebar_visible"])
    hub_allowed = bool(target.is_system_admin) or dept_nav_count > 0

    workspace_context = {
        "department_slug": department_slug,
        "department_hub_allowed": hub_allowed,
        "department_hub_rule": (
            "tenantSidebarNavItemsForSession (global) filtered to platform icons — "
            "NOT filtered by department slug"
        ),
        "simulated_sidebar_visible_count": dept_nav_count,
        "publication_builder": next((e for e in log if e.get("registry_key") == "comms_publication_builder"), None),
    }

    return {
        "user_id": str(target.id),
        "company_id": str(target.company_id) if target.company_id else None,
        "department_slug": department_slug,
        "assigned_roles": assigned,
        "department_roles": dept_roles,
        "org_roles": org_roles,
        "merged_capabilities": sorted(rbac_eff | set(bridged)),
        "legacy_platform_capabilities": _legacy_caps_from_rbac(rbac_eff),
        "visible_features": sorted(visible),
        "denied_features": sorted(denied),
        "active_department": dbg.resolved_department,
        "workspace_context": workspace_context,
        "feature_resolution_log": log,
        "access_debug": dbg_json,
        "feature_resolution_notes": [
            "Sidebar simulation = contract ∩ enabled_features (+ tenant admin bypass); RBAC checked for routes only.",
            "Department hub uses global sidebar icon filter — user may open /communications even when only maintenance modules show.",
            "Comms API routes generally lack require_rbac_* — api_allowed null means client-gated only.",
        ],
    }
