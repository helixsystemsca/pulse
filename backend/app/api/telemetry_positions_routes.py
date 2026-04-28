from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.events.engine import event_engine
from app.core.events.types import DomainEvent
from app.models.device_hub import AutomationBleDevice, BeaconPosition
from app.models.domain import User

router = APIRouter(prefix="/telemetry", tags=["telemetry-live"])


class LiveBeaconOut(BaseModel):
    beacon_id: str
    label: str
    beacon_type: str
    x_norm: float
    y_norm: float
    zone_id: Optional[str]
    position_confidence: Optional[float]
    pm_overdue: bool = False
    computed_at: datetime

    model_config = {"from_attributes": True}


class PositionsOut(BaseModel):
    beacons: list[LiveBeaconOut]


def _beacon_type(raw: str) -> str:
    t = (raw or "").lower()
    if "worker" in t:
        return "worker"
    if "equipment" in t:
        return "equipment"
    return "tool"


@router.get("/positions", response_model=PositionsOut)
async def get_live_positions(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> PositionsOut:
    if user.company_id is None:
        return PositionsOut(beacons=[])
    cid = str(user.company_id)
    rows = await db.execute(
        select(BeaconPosition, AutomationBleDevice)
        .join(AutomationBleDevice, AutomationBleDevice.id == BeaconPosition.beacon_id)
        .where(BeaconPosition.company_id == cid)
    )
    return PositionsOut(
        beacons=[
            LiveBeaconOut(
                beacon_id=pos.beacon_id,
                label=device.name or device.mac_address,
                beacon_type=_beacon_type(device.type),
                x_norm=pos.x_norm or 0.5,
                y_norm=pos.y_norm or 0.5,
                zone_id=pos.zone_id,
                position_confidence=pos.position_confidence,
                pm_overdue=False,  # TODO: join pm_tasks to flag overdue
                computed_at=pos.computed_at,
            )
            for pos, device in rows.all()
        ]
    )


@router.post("/inferences/{inference_id}/confirm", status_code=200)
async def confirm_inference(
    inference_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> dict:
    cid = str(user.company_id)
    eq_row = await db.execute(
        text("SELECT equipment_id FROM maintenance_inferences WHERE id=:id AND company_id=:cid LIMIT 1"),
        {"id": inference_id, "cid": cid},
    )
    exist = eq_row.first()
    if exist is None:
        raise HTTPException(status_code=404, detail="Inference not found")
    equipment_raw = exist[0]
    equipment_id_str = str(equipment_raw) if equipment_raw is not None else ""

    await db.execute(
        text(
            "UPDATE maintenance_inferences "
            "SET status='confirmed', confirmed_at=:now, confirmed_by=:uid "
            "WHERE id=:id AND company_id=:cid"
        ),
        {
            "id": inference_id,
            "cid": cid,
            "now": datetime.now(timezone.utc),
            "uid": str(user.id),
        },
    )
    await db.commit()
    await event_engine.publish(
        DomainEvent(
            event_type="ops.inference_confirmed",
            company_id=cid,
            entity_id=inference_id,
            source_module="telemetry",
            metadata={
                "inference_id": inference_id,
                "confirmed_by": str(user.id),
                "equipment_id": equipment_id_str,
            },
        )
    )
    return {"ok": True}


@router.post("/inferences/{inference_id}/dismiss", status_code=200)
async def dismiss_inference(
    inference_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> dict:
    await db.execute(
        text(
            "UPDATE maintenance_inferences SET status='dismissed' "
            "WHERE id=:id AND company_id=:cid"
        ),
        {"id": inference_id, "cid": str(user.company_id)},
    )
    await db.commit()
    return {"ok": True}

