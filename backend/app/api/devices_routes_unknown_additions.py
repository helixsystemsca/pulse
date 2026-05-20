"""
Patch guide — **not importable as real routes** (would need ``router``, ``get_db``, etc.).

Target: ``backend/app/api/devices_routes.py``

1. Add the ``UnknownDeviceOut`` model next to the other ``*Out`` schemas.
2. Add the two handlers after the existing routes (same ``router``, ``Depends(get_db)``, ``resolve_devices_company_id`` as that file).

---

**Schema (Block 1)**

.. code-block:: python

    from datetime import datetime
    from pydantic import BaseModel

    class UnknownDeviceOut(BaseModel):
        \"\"\"A BLE MAC address seen by a gateway but not yet registered as a BleDevice.\"\"\"
        id: str
        mac_address: str
        first_seen_at: datetime
        last_seen_at: datetime
        seen_count: int

        model_config = {\"from_attributes\": True}

---

**Routes (Block 2)**

.. code-block:: python

    @router.get(\"/ble-devices/unknown\", response_model=list[UnknownDeviceOut])
    async def list_unknown_devices(
        db: Annotated[AsyncSession, Depends(get_db)],
        company_id: Annotated[str, Depends(resolve_devices_company_id)],
        limit: int = 50,
    ) -> list[UnknownDeviceOut]:
        \"\"\"
        Return BLE MACs that were seen by a gateway but never registered.
        Sorted by last_seen_at DESC.
        \"\"\"
        from sqlalchemy import select, desc
        from app.models.device_hub import AutomationUnknownDevice

        result = await db.execute(
            select(AutomationUnknownDevice)
            .where(AutomationUnknownDevice.company_id == company_id)
            .order_by(desc(AutomationUnknownDevice.last_seen_at))
            .limit(limit)
        )
        return list(result.scalars().all())


    @router.delete(\"/ble-devices/unknown/{mac_address}\", status_code=204)
    async def dismiss_unknown_device(
        mac_address: str,
        db: Annotated[AsyncSession, Depends(get_db)],
        company_id: Annotated[str, Depends(resolve_devices_company_id)],
    ) -> None:
        \"\"\"
        Remove an unknown device from the discovery list.
        \"\"\"
        from sqlalchemy import delete
        from app.models.device_hub import AutomationUnknownDevice
        from app.services.devices.device_service import normalize_mac

        try:
            norm = normalize_mac(mac_address)
        except ValueError:
            raise HTTPException(status_code=400, detail=\"invalid_mac_address\")

        await db.execute(
            delete(AutomationUnknownDevice).where(
                AutomationUnknownDevice.company_id == company_id,
                AutomationUnknownDevice.mac_address == norm,
            )
        )
        await db.commit()
"""
