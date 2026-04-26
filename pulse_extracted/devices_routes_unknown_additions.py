"""
ADD THIS TO: backend/app/api/devices_routes.py

Insert these two blocks into the existing file:

1. Add UnknownDeviceOut to the existing imports/schemas section (near the other Out types)
2. Add the two new route handlers after the existing @router.post("/zones") section

The router, deps, DeviceService, and all imports are already present in devices_routes.py.
These additions follow the exact same patterns as the existing routes in that file.
"""

# ─────────────────────────────────────────────────────────────────────────────
# BLOCK 1 — Add this Pydantic schema near the other Out schemas at the top of
#            devices_routes.py (after the existing GatewayOut, BleDeviceOut etc.)
# ─────────────────────────────────────────────────────────────────────────────

from datetime import datetime
from pydantic import BaseModel

class UnknownDeviceOut(BaseModel):
    """A BLE MAC address seen by a gateway but not yet registered as a BleDevice."""
    id: str
    mac_address: str
    first_seen_at: datetime
    last_seen_at: datetime
    seen_count: int

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────────────────
# BLOCK 2 — Add these two routes to devices_routes.py after the existing routes.
#            The router, db, company_id resolution, and DeviceService are already
#            imported and available in that file.
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/ble-devices/unknown", response_model=list[UnknownDeviceOut])
async def list_unknown_devices(
    db: Annotated[AsyncSession, Depends(get_db)],
    company_id: Annotated[str, Depends(resolve_devices_company_id)],
    limit: int = 50,
) -> list[UnknownDeviceOut]:
    """
    Return BLE MACs that were seen by a gateway but never registered.

    These are logged automatically by the telemetry ingest endpoint whenever
    an ESP32 reports a MAC that doesn't match any AutomationBleDevice row.
    The Devices tab UI uses this to show a "Discovered · Not Registered" panel
    so operators can register beacons on-the-spot while walking the facility.

    Sorted by last_seen_at DESC so the most recently active unknowns appear first.
    """
    from sqlalchemy import select, desc
    from app.models.device_hub import AutomationUnknownDevice

    result = await db.execute(
        select(AutomationUnknownDevice)
        .where(AutomationUnknownDevice.company_id == company_id)
        .order_by(desc(AutomationUnknownDevice.last_seen_at))
        .limit(limit)
    )
    return list(result.scalars().all())


@router.delete("/ble-devices/unknown/{mac_address}", status_code=204)
async def dismiss_unknown_device(
    mac_address: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    company_id: Annotated[str, Depends(resolve_devices_company_id)],
) -> None:
    """
    Remove an unknown device from the discovery list.

    Called when an operator clicks "Dismiss" on a discovered MAC they don't
    want to register (e.g. a visitor's phone, a neighbour's beacon, noise).
    If the gateway sees it again, it will re-appear automatically.
    """
    from sqlalchemy import delete
    from app.models.device_hub import AutomationUnknownDevice
    from app.services.devices.device_service import normalize_mac

    try:
        norm = normalize_mac(mac_address)
    except ValueError:
        raise HTTPException(status_code=400, detail="invalid_mac_address")

    await db.execute(
        delete(AutomationUnknownDevice).where(
            AutomationUnknownDevice.company_id == company_id,
            AutomationUnknownDevice.mac_address == norm,
        )
    )
    await db.commit()
