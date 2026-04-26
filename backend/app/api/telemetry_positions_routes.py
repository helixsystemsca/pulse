from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
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
    await db.execute(
        text(
            "UPDATE maintenance_inferences "
            "SET status='confirmed', confirmed_at=:now, confirmed_by=:uid "
            "WHERE id=:id AND company_id=:cid"
        ),
        {
            "id": inference_id,
            "cid": str(user.company_id),
            "now": datetime.now(timezone.utc),
            "uid": str(user.id),
        },
    )
    await db.commit()
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

