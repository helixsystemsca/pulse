"""Registry of QR-linkable resource types (extensible without modifying QR core)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Optional

DestinationFn = Callable[[str], str]


@dataclass(frozen=True)
class QrResourceTypeDef:
    key: str
    label: str
    destination_path: DestinationFn
    guest_view_path: DestinationFn
    rbac_permissions: tuple[str, ...]
    guest_rbac_permissions: tuple[str, ...] = ()


def _zone_path(resource_id: str) -> str:
    return f"/inventory/zones/{resource_id}"


def _zone_guest_path(resource_id: str) -> str:
    return f"/inventory/zones/{resource_id}?guest=1"


QR_RESOURCE_TYPE_REGISTRY: dict[str, QrResourceTypeDef] = {
    "inventory_zone": QrResourceTypeDef(
        key="inventory_zone",
        label="Inventory Zone",
        destination_path=_zone_path,
        guest_view_path=_zone_guest_path,
        rbac_permissions=("inventory.view", "inventory.manage", "inventory.scan"),
        guest_rbac_permissions=("inventory.view",),
    ),
    "location": QrResourceTypeDef(
        key="location",
        label="Storage Location",
        destination_path=_zone_path,
        guest_view_path=_zone_guest_path,
        rbac_permissions=("inventory.view", "inventory.manage", "inventory.scan"),
        guest_rbac_permissions=("inventory.view",),
    ),
    "room": QrResourceTypeDef(
        key="room",
        label="Room",
        destination_path=_zone_path,
        guest_view_path=_zone_guest_path,
        rbac_permissions=("inventory.view", "inventory.manage", "inventory.scan"),
        guest_rbac_permissions=("inventory.view",),
    ),
    "cabinet": QrResourceTypeDef(
        key="cabinet",
        label="Cabinet",
        destination_path=_zone_path,
        guest_view_path=_zone_guest_path,
        rbac_permissions=("inventory.view", "inventory.manage", "inventory.scan"),
        guest_rbac_permissions=("inventory.view",),
    ),
    "fridge": QrResourceTypeDef(
        key="fridge",
        label="Fridge",
        destination_path=_zone_path,
        guest_view_path=_zone_guest_path,
        rbac_permissions=("inventory.view", "inventory.manage", "inventory.scan"),
        guest_rbac_permissions=("inventory.view",),
    ),
    "equipment": QrResourceTypeDef(
        key="equipment",
        label="Equipment",
        destination_path=lambda rid: f"/equipment/{rid}",
        guest_view_path=lambda rid: f"/equipment/{rid}?guest=1",
        rbac_permissions=("equipment.view", "equipment.manage"),
        guest_rbac_permissions=("equipment.view",),
    ),
    "vehicle": QrResourceTypeDef(
        key="vehicle",
        label="Vehicle",
        destination_path=lambda rid: f"/dashboard/vehicles/{rid}",
        guest_view_path=lambda rid: f"/dashboard/vehicles/{rid}?guest=1",
        rbac_permissions=("equipment.view", "equipment.manage"),
        guest_rbac_permissions=("equipment.view",),
    ),
    "procedure": QrResourceTypeDef(
        key="procedure",
        label="Procedure",
        destination_path=lambda rid: f"/training/learning/library?procedure={rid}",
        guest_view_path=lambda rid: f"/training/learning/library?procedure={rid}&guest=1",
        rbac_permissions=("procedures.view", "procedures.edit"),
        guest_rbac_permissions=("procedures.view",),
    ),
    "drawing": QrResourceTypeDef(
        key="drawing",
        label="Drawing",
        destination_path=lambda rid: f"/drawings?map={rid}",
        guest_view_path=lambda rid: f"/drawings?map={rid}&guest=1",
        rbac_permissions=("drawings.view",),
        guest_rbac_permissions=("drawings.view",),
    ),
}

ALL_QR_RESOURCE_TYPES: tuple[str, ...] = tuple(QR_RESOURCE_TYPE_REGISTRY.keys())

GUEST_ACCESS_NONE = "none"
GUEST_ACCESS_READ_ONLY = "read_only"
ALL_GUEST_ACCESS_LEVELS: tuple[str, ...] = (GUEST_ACCESS_NONE, GUEST_ACCESS_READ_ONLY)


def normalize_resource_type(raw: str) -> Optional[str]:
    key = (raw or "").strip().lower()
    return key if key in QR_RESOURCE_TYPE_REGISTRY else None


def normalize_guest_access_level(raw: str) -> str:
    key = (raw or "").strip().lower()
    return key if key in ALL_GUEST_ACCESS_LEVELS else GUEST_ACCESS_NONE


def destination_for(resource_type: str, resource_id: str, *, guest: bool = False) -> str:
    defn = QR_RESOURCE_TYPE_REGISTRY.get(resource_type)
    if defn is None:
        return "/overview"
    if guest:
        return defn.guest_view_path(resource_id)
    return defn.destination_path(resource_id)
