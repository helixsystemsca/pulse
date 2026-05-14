"""
Capability-oriented module surfaces (product areas → required RBAC keys).

Downstream consumers (sidebar, route manifests, widgets) should converge on this list instead of
re-inventing permission tuples. Frontend parity is still evolving; backend enforcement uses
`require_rbac_any` / `require_rbac_all` with `RbacPermissionKey` or validated string keys.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final


@dataclass(frozen=True, slots=True)
class TenantModuleSurface:
    id: str
    label: str
    required_permissions: tuple[str, ...]


TENANT_MODULE_SURFACES: Final[tuple[TenantModuleSurface, ...]] = (
    TenantModuleSurface("monitoring", "Monitoring", ("monitoring.view",)),
    TenantModuleSurface("inventory", "Inventory", ("inventory.view",)),
    TenantModuleSurface("inventory_manage", "Inventory (manage)", ("inventory.manage",)),
    TenantModuleSurface("schedule", "Scheduling", ("schedule.view",)),
    TenantModuleSurface("projects", "Projects", ("projects.view",)),
    TenantModuleSurface("work_requests", "Work requests", ("work_requests.view", "work_requests.edit")),
    TenantModuleSurface("messaging", "Messaging", ("messaging.view",)),
    TenantModuleSurface("procedures", "Procedures / standards", ("procedures.view",)),
    TenantModuleSurface("team_management", "Team management", ("team_management.view",)),
    TenantModuleSurface("dashboard", "Leadership / operations dashboard", ("dashboard.view",)),
    TenantModuleSurface("zones_devices", "Zones & devices", ("zones_devices.view",)),
    TenantModuleSurface("equipment", "Equipment", ("equipment.view",)),
    TenantModuleSurface("drawings", "Drawings", ("drawings.view",)),
    TenantModuleSurface("live_map", "Live map", ("live_map.view",)),
    TenantModuleSurface("compliance", "Compliance", ("compliance.view",)),
)
