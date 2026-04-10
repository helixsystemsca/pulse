"""ESP32 captive-portal onboarding: register or refresh gateway (no JWT)."""

from __future__ import annotations

import hmac
import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.config import get_settings
from app.limiter import limiter
from app.schemas.devices import GatewayRegisterIn
from app.services.devices.device_service import DeviceService, normalize_gateway_identifier

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/gateway", tags=["gateway-register"])


def _register_tokens_match(provided: Optional[str], expected: str) -> bool:
    if provided is None or not expected:
        return False
    if len(provided) != len(expected):
        return False
    return hmac.compare_digest(provided.encode("utf-8"), expected.encode("utf-8"))


@router.post("/register")
@limiter.limit("60/minute")
async def register_gateway(
    request: Request,
    body: GatewayRegisterIn,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, bool]:
    _ = request
    settings = get_settings()
    svc = DeviceService(db)
    rows = await svc.list_gateways_by_identifier_global(body.gateway_id)
    created = False

    if len(rows) == 1:
        await svc.mark_gateway_seen_online(rows[0])
    elif len(rows) == 0:
        target_cid = ""
        tok = settings.gateway_register_token.strip()
        if body.company_id and tok and _register_tokens_match(body.register_token, tok):
            target_cid = body.company_id.strip()
        elif settings.gateway_auto_register_company_id.strip():
            target_cid = settings.gateway_auto_register_company_id.strip()

        if target_cid:
            if await svc.company_exists(target_cid):
                ident = normalize_gateway_identifier(body.gateway_id)
                gw_new = await svc.create_gateway(
                    company_id=target_cid,
                    name=f"Gateway {ident}",
                    identifier=body.gateway_id,
                    zone_id=None,
                    assigned=False,
                )
                await svc.mark_gateway_seen_online(gw_new)
                created = True
            else:
                logger.warning("gateway_register: company not found for auto-register prefix=%s", target_cid[:8])
        else:
            logger.warning(
                "gateway_register: unknown gateway_id=%s (no row; set GATEWAY_AUTO_REGISTER_COMPANY_ID or token+company_id)",
                body.gateway_id,
            )
    else:
        logger.warning("gateway_register: ambiguous identifier %s (%d rows)", body.gateway_id, len(rows))

    await db.commit()
    logger.info(
        "gateway_register gateway_id=%s ip=%s firmware_version=%s created=%s",
        body.gateway_id,
        body.ip,
        body.firmware_version,
        created,
    )
    return {"ok": True, "created": created}
