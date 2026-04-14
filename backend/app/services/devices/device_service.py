"""CRUD for automation gateways, BLE tags, equipment (`Tool`), and zones — company-scoped, async-only."""

from __future__ import annotations

import re
import secrets
from datetime import datetime, timezone
from typing import Any, Optional, Tuple
from uuid import uuid4

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth.security import hash_password
from app.models.device_hub import AutomationBleDevice, AutomationGateway
from app.models.domain import Company, Tool, ToolStatus, User, Zone


def _uuid_str() -> str:
    return str(uuid4())


def normalize_mac(raw: str) -> str:
    """Normalize to 12 hex digits as `AA:BB:CC:DD:EE:FF`."""
    s = raw.strip().upper()
    s = re.sub(r"[^0-9A-F]", "", s)
    if len(s) != 12 or not re.fullmatch(r"[0-9A-F]{12}", s):
        raise ValueError("mac_address must be 12 hexadecimal digits")
    return ":".join(s[i : i + 2] for i in range(0, 12, 2))


def normalize_gateway_identifier(raw: str) -> str:
    return raw.strip()


BLE_WORKER_TAG = "worker_tag"
BLE_EQUIPMENT_TAG = "equipment_tag"


class DeviceService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def create_gateway(
        self,
        *,
        company_id: str,
        name: str,
        identifier: str,
        zone_id: Optional[str] = None,
        assigned: Optional[bool] = None,
    ) -> AutomationGateway:
        ident = normalize_gateway_identifier(identifier)
        if not ident:
            raise ValueError("identifier is required")
        resolved_assigned = bool(zone_id) if assigned is None else bool(assigned)
        gw = AutomationGateway(
            id=_uuid_str(),
            company_id=company_id,
            name=name.strip(),
            identifier=ident,
            status="online",
            zone_id=zone_id,
            assigned=resolved_assigned,
        )
        self._db.add(gw)
        await self._db.flush()
        return gw

    async def get_gateway(self, *, company_id: str, gateway_id: str) -> Optional[AutomationGateway]:
        q = await self._db.execute(
            select(AutomationGateway).where(
                AutomationGateway.id == gateway_id,
                AutomationGateway.company_id == company_id,
            )
        )
        return q.scalar_one_or_none()

    async def get_gateway_by_identifier(self, *, company_id: str, identifier: str) -> Optional[AutomationGateway]:
        ident = normalize_gateway_identifier(identifier)
        if not ident:
            return None
        q = await self._db.execute(
            select(AutomationGateway).where(
                AutomationGateway.company_id == company_id,
                AutomationGateway.identifier == ident,
            )
        )
        return q.scalar_one_or_none()

    async def list_gateways_by_identifier_global(self, identifier: str) -> list[AutomationGateway]:
        ident = normalize_gateway_identifier(identifier)
        if not ident:
            return []
        q = await self._db.execute(select(AutomationGateway).where(AutomationGateway.identifier == ident))
        return list(q.scalars().all())

    async def mark_gateway_seen_online(self, gw: AutomationGateway) -> None:
        gw.last_seen_at = datetime.now(timezone.utc)
        gw.status = "online"
        await self._db.flush()

    async def company_exists(self, company_id: str) -> bool:
        q = await self._db.execute(select(Company.id).where(Company.id == company_id))
        return q.scalar_one_or_none() is not None

    async def get_gateway_by_id_only(self, gateway_id: str) -> Optional[AutomationGateway]:
        """Resolve gateway by primary key (globally unique) — device ingest only."""
        q = await self._db.execute(select(AutomationGateway).where(AutomationGateway.id == gateway_id))
        return q.scalar_one_or_none()

    async def rotate_gateway_ingest_secret(self, *, company_id: str, gateway_id: str) -> Tuple[AutomationGateway, str]:
        gw = await self.get_gateway(company_id=company_id, gateway_id=gateway_id)
        if not gw:
            raise LookupError("gateway_not_found")
        plain = secrets.token_urlsafe(32)
        gw.ingest_secret_hash = hash_password(plain)
        await self._db.flush()
        return gw, plain

    async def list_gateways(self, *, company_id: str, unassigned_only: bool = False) -> list[AutomationGateway]:
        q = select(AutomationGateway).where(AutomationGateway.company_id == company_id)
        if unassigned_only:
            q = q.where(AutomationGateway.assigned.is_(False))
        q = q.order_by(AutomationGateway.name)
        rows = await self._db.execute(q)
        return list(rows.scalars().all())

    async def patch_gateway(
        self,
        *,
        company_id: str,
        gateway_id: str,
        updates: dict[str, Any],
    ) -> AutomationGateway:
        gw = await self.get_gateway(company_id=company_id, gateway_id=gateway_id)
        if not gw:
            raise LookupError("gateway_not_found")
        if "zone_id" in updates:
            gw.zone_id = updates["zone_id"]
        if "assigned" in updates:
            gw.assigned = bool(updates["assigned"])
        elif "zone_id" in updates and updates.get("zone_id"):
            gw.assigned = True
        if "name" in updates:
            gw.name = str(updates["name"]).strip()
        if "status" in updates:
            gw.status = str(updates["status"]).strip().lower()
        await self._db.flush()
        return gw

    async def create_ble_device(
        self,
        *,
        company_id: str,
        name: str,
        mac_address: str,
        ble_type: str,
        assigned_worker_id: Optional[str] = None,
        assigned_equipment_id: Optional[str] = None,
    ) -> AutomationBleDevice:
        mac = normalize_mac(mac_address)
        bt = ble_type.strip().lower()
        if bt not in (BLE_WORKER_TAG, BLE_EQUIPMENT_TAG):
            raise ValueError("type must be worker_tag or equipment_tag")
        if assigned_worker_id and assigned_equipment_id:
            raise ValueError("assign to either worker or equipment, not both")
        if bt == BLE_WORKER_TAG and assigned_equipment_id:
            raise ValueError("worker_tag cannot assign equipment_id")
        if bt == BLE_EQUIPMENT_TAG and assigned_worker_id:
            raise ValueError("equipment_tag cannot assign worker_id")

        row = AutomationBleDevice(
            id=_uuid_str(),
            company_id=company_id,
            name=name.strip(),
            mac_address=mac,
            type=bt,
            assigned_worker_id=assigned_worker_id,
            assigned_equipment_id=assigned_equipment_id,
        )
        self._db.add(row)
        await self._db.flush()
        return row

    async def list_ble_devices(self, *, company_id: str) -> list[AutomationBleDevice]:
        q = await self._db.execute(
            select(AutomationBleDevice)
            .where(AutomationBleDevice.company_id == company_id)
            .order_by(AutomationBleDevice.name)
        )
        return list(q.scalars().all())

    async def list_equipment(self, *, company_id: str) -> list[Tool]:
        q = await self._db.execute(
            select(Tool).where(Tool.company_id == company_id).order_by(Tool.name)
        )
        return list(q.scalars().all())

    async def list_zones(self, *, company_id: str) -> list[Zone]:
        q = await self._db.execute(
            select(Zone).where(Zone.company_id == company_id).order_by(Zone.name)
        )
        return list(q.scalars().all())

    async def get_zone(self, *, company_id: str, zone_id: str) -> Optional[Zone]:
        q = await self._db.execute(
            select(Zone).where(Zone.id == zone_id, Zone.company_id == company_id)
        )
        return q.scalar_one_or_none()

    async def update_zone(
        self,
        *,
        company_id: str,
        zone_id: str,
        updates: dict[str, Any],
    ) -> Zone:
        z = await self.get_zone(company_id=company_id, zone_id=zone_id)
        if not z:
            raise LookupError("zone_not_found")
        if "name" in updates:
            nz = str(updates["name"] or "").strip()
            if not nz:
                raise ValueError("zone name is required")
            z.name = nz
        if "description" in updates:
            raw = updates["description"]
            if raw is None:
                z.description = None
            else:
                s = str(raw).strip()
                z.description = s if s else None
        await self._db.flush()
        return z

    async def delete_zone(self, *, company_id: str, zone_id: str) -> None:
        res = await self._db.execute(
            delete(Zone).where(Zone.id == zone_id, Zone.company_id == company_id)
        )
        if not res.rowcount:
            raise LookupError("zone_not_found")
        await self._db.flush()

    async def get_ble_device(self, *, company_id: str, ble_id: str) -> Optional[AutomationBleDevice]:
        q = await self._db.execute(
            select(AutomationBleDevice).where(
                AutomationBleDevice.id == ble_id,
                AutomationBleDevice.company_id == company_id,
            )
        )
        return q.scalar_one_or_none()

    async def get_ble_by_mac(self, *, company_id: str, mac: str) -> Optional[AutomationBleDevice]:
        try:
            mac_n = normalize_mac(mac)
        except ValueError:
            return None
        q = await self._db.execute(
            select(AutomationBleDevice).where(
                AutomationBleDevice.company_id == company_id,
                AutomationBleDevice.mac_address == mac_n,
            )
        )
        return q.scalar_one_or_none()

    async def assign_ble_device(
        self,
        *,
        company_id: str,
        ble_id: str,
        assigned_worker_id: Optional[str] = None,
        assigned_equipment_id: Optional[str] = None,
    ) -> AutomationBleDevice:
        row = await self.get_ble_device(company_id=company_id, ble_id=ble_id)
        if not row:
            raise LookupError("ble_device_not_found")
        if assigned_worker_id and assigned_equipment_id:
            raise ValueError("assign to either worker or equipment, not both")
        if row.type == BLE_WORKER_TAG:
            row.assigned_worker_id = assigned_worker_id
            row.assigned_equipment_id = None
        elif row.type == BLE_EQUIPMENT_TAG:
            row.assigned_equipment_id = assigned_equipment_id
            row.assigned_worker_id = None
        else:
            raise ValueError("unsupported_ble_type")
        await self._db.flush()
        return row

    async def create_equipment(
        self,
        *,
        company_id: str,
        name: str,
        equipment_type: Optional[str] = None,
        tag_id: Optional[str] = None,
        zone_id: Optional[str] = None,
        status: ToolStatus = ToolStatus.available,
    ) -> Tool:
        tid = (tag_id or "").strip() or f"eq-{_uuid_str()}"
        display_name = name.strip()
        if equipment_type:
            display_name = f"{display_name} ({equipment_type.strip()})"
        tool = Tool(
            id=_uuid_str(),
            company_id=company_id,
            tag_id=tid,
            name=display_name,
            zone_id=zone_id,
            status=status,
        )
        self._db.add(tool)
        await self._db.flush()
        return tool

    async def get_tool(self, *, company_id: str, tool_id: str) -> Optional[Tool]:
        q = await self._db.execute(
            select(Tool).where(
                Tool.id == tool_id,
                Tool.company_id == company_id,
            )
        )
        return q.scalar_one_or_none()

    async def link_ble_to_equipment(
        self,
        *,
        company_id: str,
        ble_id: str,
        equipment_id: str,
    ) -> AutomationBleDevice:
        ble = await self.get_ble_device(company_id=company_id, ble_id=ble_id)
        if not ble:
            raise LookupError("ble_device_not_found")
        if ble.type != BLE_EQUIPMENT_TAG:
            raise ValueError("only_equipment_tags_can_link_to_equipment")
        tool = await self.get_tool(company_id=company_id, tool_id=equipment_id)
        if not tool:
            raise LookupError("equipment_not_found")
        ble.assigned_equipment_id = equipment_id
        ble.assigned_worker_id = None
        await self._db.flush()
        return ble

    async def create_zone(
        self,
        *,
        company_id: str,
        name: str,
        description: Optional[str] = None,
        meta: Optional[dict[str, Any]] = None,
    ) -> Zone:
        z = Zone(
            id=_uuid_str(),
            company_id=company_id,
            name=name.strip(),
            description=description.strip() if description else None,
            meta=dict(meta or {}),
        )
        self._db.add(z)
        await self._db.flush()
        return z

    async def ensure_user_in_company(self, *, company_id: str, user_id: str) -> None:
        q = await self._db.execute(select(User).where(User.id == user_id))
        u = q.scalar_one_or_none()
        if not u or str(u.company_id) != str(company_id):
            raise LookupError("user_not_in_company")
