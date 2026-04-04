"""Outbound-only gateway ingest: X-Gateway-Id + Bearer secret (no end-user JWT)."""

from __future__ import annotations

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.audit.service import record_audit
from app.core.auth.security import verify_password
from app.limiter import limiter
from app.models.device_hub import AutomationGateway
from app.schemas.automation_engine import AutomationEventAccepted, AutomationEventIn
from app.services.automation.ingest_pipeline import ingest_automation_event
from app.services.devices.device_service import DeviceService

logger = logging.getLogger("security.device_ingest")

router = APIRouter(prefix="/device", tags=["device-ingest"])


async def require_gateway_device(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    x_gateway_id: Annotated[str, Header(alias="X-Gateway-Id")],
    authorization: Annotated[str, Header()],
) -> AutomationGateway:
    parts = authorization.split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        logger.warning(
            "device_ingest invalid_authorization_scheme ip=%s",
            request.client.host if request.client else "",
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_authorization")

    secret = parts[1].strip()
    gid = x_gateway_id.strip()
    try:
        UUID(gid)
    except ValueError:
        logger.warning("device_ingest invalid_gateway_id_format ip=%s", request.client.host if request.client else "")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_gateway_credentials")

    svc = DeviceService(db)
    gw = await svc.get_gateway_by_id_only(gid)
    if gw is None or not gw.ingest_secret_hash:
        logger.warning(
            "device_ingest unknown_or_unprovisioned ip=%s gateway_prefix=%s",
            request.client.host if request.client else "",
            gid[:8],
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_gateway_credentials")

    if not verify_password(secret, gw.ingest_secret_hash):
        logger.warning("device_ingest bad_secret gateway_id=%s company_id=%s", gw.id, gw.company_id)
        await record_audit(
            db,
            action="device.ingest_auth_failed",
            company_id=gw.company_id,
            metadata={"gateway_id": gw.id},
        )
        await db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_gateway_credentials")

    return gw


@router.post("/events", response_model=AutomationEventAccepted)
@limiter.limit("600/minute")
async def ingest_device_event(
    request: Request,
    body: AutomationEventIn,
    db: Annotated[AsyncSession, Depends(get_db)],
    gateway: Annotated[AutomationGateway, Depends(require_gateway_device)],
) -> AutomationEventAccepted:
    _ = request
    return await ingest_automation_event(db, company_id=str(gateway.company_id), body=body)
