"""Device hub: gateways (ESP32), BLE tags, tracked tools (`/api/v1/tools`), zones — `/api/v1/*`."""

from __future__ import annotations

from typing import Annotated, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_manager_or_above
from app.core.user_roles import user_has_any_role
from app.core.audit.service import record_audit
from app.services.onboarding_service import try_mark_onboarding_step
from app.models.domain import ToolStatus, User, UserRole
from app.schemas.api_common import ApiSuccess
from app.schemas.devices import (
    BleDeviceAssignIn,
    BleDeviceCreateIn,
    BleDeviceOut,
    EquipmentCreateIn,
    EquipmentLinkBleIn,
    EquipmentOut,
    GatewayCreateIn,
    GatewayIngestSecretRotateOut,
    GatewayOut,
    GatewayPatchIn,
    ZoneCreateIn,
    ZoneOut,
)
from app.services.automation.operational_service import list_gateway_operational_status
from app.services.devices.device_service import DeviceService

router = APIRouter(tags=["devices"])


async def resolve_devices_company_id(
    user: Annotated[User, Depends(require_manager_or_above)],
    company_id: Optional[str] = Query(None, description="Required for system administrators"),
) -> str:
    if user_has_any_role(user, UserRole.system_admin) or user.is_system_admin:
        if not company_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="company_id is required for system administrators")
        return company_id
    if user.company_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a tenant user")
    cid = str(user.company_id)
    if company_id is not None and company_id != cid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Company access denied")
    return cid


CompanyId = Annotated[str, Depends(resolve_devices_company_id)]
Db = Annotated[AsyncSession, Depends(get_db)]
Actor = Annotated[User, Depends(require_manager_or_above)]


def _svc(db: AsyncSession) -> DeviceService:
    return DeviceService(db)


@router.post("/gateways", response_model=GatewayOut, status_code=status.HTTP_201_CREATED)
async def create_gateway(
    body: GatewayCreateIn,
    db: Db,
    company_id: CompanyId,
    actor: Actor,
) -> GatewayOut:
    try:
        gw = await _svc(db).create_gateway(
            company_id=company_id,
            name=body.name,
            identifier=body.identifier,
            zone_id=body.zone_id,
        )
        await try_mark_onboarding_step(db, actor.id, "add_device")
        await db.commit()
        await db.refresh(gw)
        return GatewayOut.model_validate(gw)
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.post("/gateways/{gateway_id}/ingest-secret/rotate", response_model=GatewayIngestSecretRotateOut)
async def rotate_gateway_ingest_secret(
    gateway_id: str,
    db: Db,
    company_id: CompanyId,
    actor: Actor,
) -> GatewayIngestSecretRotateOut:
    try:
        gw, plain = await _svc(db).rotate_gateway_ingest_secret(company_id=company_id, gateway_id=gateway_id)
        await record_audit(
            db,
            action="device.gateway_ingest_secret_rotated",
            actor_user_id=actor.id,
            company_id=company_id,
            metadata={"gateway_id": gateway_id},
        )
        await db.commit()
        await db.refresh(gw)
        return GatewayIngestSecretRotateOut(gateway_id=gw.id, ingest_secret=plain)
    except LookupError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="gateway not found") from None


@router.patch("/gateways/{gateway_id}", response_model=GatewayOut)
async def patch_gateway(
    gateway_id: str,
    body: GatewayPatchIn,
    db: Db,
    company_id: CompanyId,
) -> GatewayOut:
    try:
        gw = await _svc(db).patch_gateway(
            company_id=company_id,
            gateway_id=gateway_id,
            updates=body.model_dump(exclude_unset=True),
        )
        await db.commit()
        await db.refresh(gw)
        return GatewayOut.model_validate(gw)
    except LookupError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="gateway not found") from None


@router.get("/gateways", response_model=list[GatewayOut])
async def list_gateways(
    db: Db,
    company_id: CompanyId,
) -> list[GatewayOut]:
    rows = await _svc(db).list_gateways(company_id=company_id)
    return [GatewayOut.model_validate(r) for r in rows]


@router.get("/ble-devices", response_model=list[BleDeviceOut])
async def list_ble_devices(
    db: Db,
    company_id: CompanyId,
) -> list[BleDeviceOut]:
    rows = await _svc(db).list_ble_devices(company_id=company_id)
    return [BleDeviceOut.model_validate(r) for r in rows]


@router.get("/tools", response_model=list[EquipmentOut])
async def list_tools(
    db: Db,
    company_id: CompanyId,
) -> list[EquipmentOut]:
    """Tracked tools / BLE-tagged equipment (distinct from facility registry at `GET /api/v1/equipment`)."""
    rows = await _svc(db).list_equipment(company_id=company_id)
    return [EquipmentOut.model_validate(r) for r in rows]


@router.get("/zones", response_model=list[ZoneOut])
async def list_zones(
    db: Db,
    company_id: CompanyId,
) -> list[ZoneOut]:
    rows = await _svc(db).list_zones(company_id=company_id)
    return [ZoneOut.model_validate(r) for r in rows]


@router.get("/gateways/status", response_model=ApiSuccess[list[dict[str, Any]]])
async def gateways_operational_status(
    db: Db,
    company_id: CompanyId,
    offline_after_seconds: float = Query(
        10.0,
        ge=1.0,
        le=86400.0,
        description="Mark gateway offline if last_seen_at is older than this many seconds",
    ),
) -> ApiSuccess[list[dict[str, Any]]]:
    rows = await list_gateway_operational_status(
        db, company_id=company_id, offline_after_seconds=offline_after_seconds
    )
    return ApiSuccess(
        data=rows,
        meta={"offline_after_seconds": offline_after_seconds},
    )


@router.post("/ble-devices", response_model=BleDeviceOut, status_code=status.HTTP_201_CREATED)
async def create_ble_device(
    body: BleDeviceCreateIn,
    db: Db,
    company_id: CompanyId,
    actor: Actor,
) -> BleDeviceOut:
    svc = _svc(db)
    try:
        if body.assigned_worker_id:
            await svc.ensure_user_in_company(company_id=company_id, user_id=body.assigned_worker_id)
        if body.assigned_equipment_id:
            t = await svc.get_tool(company_id=company_id, tool_id=body.assigned_equipment_id)
            if not t:
                raise LookupError("equipment_not_found")
        row = await svc.create_ble_device(
            company_id=company_id,
            name=body.name,
            mac_address=body.mac_address,
            ble_type=body.type,
            assigned_worker_id=body.assigned_worker_id,
            assigned_equipment_id=body.assigned_equipment_id,
        )
        await try_mark_onboarding_step(db, actor.id, "add_device")
        await db.commit()
        await db.refresh(row)
        return BleDeviceOut.model_validate(row)
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except LookupError as e:
        await db.rollback()
        msg = str(e.args[0]) if e.args else "not_found"
        if msg == "user_not_in_company":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="user not in company") from e
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="equipment not found") from e


@router.patch("/ble-devices/{ble_id}/assign", response_model=BleDeviceOut)
async def assign_ble_device(
    ble_id: str,
    body: BleDeviceAssignIn,
    db: Db,
    company_id: CompanyId,
) -> BleDeviceOut:
    svc = _svc(db)
    try:
        if body.assigned_worker_id:
            await svc.ensure_user_in_company(company_id=company_id, user_id=body.assigned_worker_id)
        if body.assigned_equipment_id:
            t = await svc.get_tool(company_id=company_id, tool_id=body.assigned_equipment_id)
            if not t:
                raise LookupError("equipment_not_found")
        row = await svc.assign_ble_device(
            company_id=company_id,
            ble_id=ble_id,
            assigned_worker_id=body.assigned_worker_id,
            assigned_equipment_id=body.assigned_equipment_id,
        )
        await db.commit()
        await db.refresh(row)
        return BleDeviceOut.model_validate(row)
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except LookupError as e:
        await db.rollback()
        if str(e.args[0]) == "user_not_in_company":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="user not in company") from e
        if str(e.args[0]) == "equipment_not_found":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="equipment not found") from e
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="BLE device not found") from e


@router.post("/tools", response_model=EquipmentOut, status_code=status.HTTP_201_CREATED)
async def create_tool(
    body: EquipmentCreateIn,
    db: Db,
    company_id: CompanyId,
    actor: Actor,
) -> EquipmentOut:
    svc = _svc(db)
    try:
        st = ToolStatus.available
        if body.status:
            try:
                st = ToolStatus(body.status)
            except ValueError as e:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid status") from e
        tool = await svc.create_equipment(
            company_id=company_id,
            name=body.name,
            equipment_type=body.type,
            tag_id=body.tag_id,
            zone_id=body.zone_id,
            status=st,
        )
        if body.link_ble_device_id:
            await svc.link_ble_to_equipment(
                company_id=company_id,
                ble_id=body.link_ble_device_id,
                equipment_id=tool.id,
            )
        await try_mark_onboarding_step(db, actor.id, "add_device")
        await db.commit()
        await db.refresh(tool)
        return EquipmentOut.model_validate(tool)
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except LookupError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="BLE device not found") from None


@router.post("/tools/{equipment_id}/link-ble", response_model=BleDeviceOut)
async def link_tool_ble(
    equipment_id: str,
    body: EquipmentLinkBleIn,
    db: Db,
    company_id: CompanyId,
) -> BleDeviceOut:
    try:
        row = await _svc(db).link_ble_to_equipment(
            company_id=company_id,
            ble_id=body.ble_device_id,
            equipment_id=equipment_id,
        )
        await db.commit()
        await db.refresh(row)
        return BleDeviceOut.model_validate(row)
    except LookupError as e:
        await db.rollback()
        code = str(e.args[0]) if e.args else ""
        if code == "equipment_not_found":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="equipment not found") from e
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="BLE device not found") from e
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.post("/zones", response_model=ZoneOut, status_code=status.HTTP_201_CREATED)
async def create_zone(
    body: ZoneCreateIn,
    db: Db,
    company_id: CompanyId,
    actor: Actor,
) -> ZoneOut:
    z = await _svc(db).create_zone(
        company_id=company_id,
        name=body.name,
        description=body.description,
        meta=body.meta,
    )
    await try_mark_onboarding_step(db, actor.id, "create_zone")
    await db.commit()
    await db.refresh(z)
    return ZoneOut.model_validate(z)
