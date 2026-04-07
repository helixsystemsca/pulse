"""WebSocket hub: company-scoped streaming of domain events."""

from __future__ import annotations

import json
import logging
from typing import Dict, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import JWTError
from sqlalchemy import select

from app.core.auth.security import decode_token
from app.core.database import AsyncSessionLocal
from app.core.events.engine import event_engine
from app.core.events.types import DomainEvent
from app.core.user_roles import primary_jwt_role, roles_match_token, user_has_any_role
from app.models.domain import User, UserRole

logger = logging.getLogger(__name__)
router = APIRouter(tags=["realtime"])

_connections: Dict[str, Set[WebSocket]] = {}


async def _broadcast_handler(event: DomainEvent) -> None:
    conns = _connections.get(event.company_id)
    if not conns:
        return
    message = json.dumps(
        {
            "event_type": event.event_type,
            "entity_id": event.entity_id,
            "metadata": event.metadata,
            "payload": event.metadata,
            "correlation_id": event.correlation_id,
            "source_module": event.source_module,
            "occurred_at": event.occurred_at.isoformat(),
        },
        default=str,
    )
    dead: list[WebSocket] = []
    for ws in conns:
        try:
            await ws.send_text(message)
        except Exception:
            dead.append(ws)
    for ws in dead:
        conns.discard(ws)


_bridge_attached = False


def attach_event_bridge() -> None:
    global _bridge_attached
    if _bridge_attached:
        return
    event_engine.subscribe("*", _broadcast_handler)
    _bridge_attached = True


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str | None = None) -> None:
    if not token:
        await websocket.close(code=4401)
        return
    try:
        data = decode_token(token)
        user_id = data["sub"]
        token_company = data.get("company_id")
    except (JWTError, KeyError):
        await websocket.close(code=4401)
        return

    async with AsyncSessionLocal() as session:
        q = await session.execute(select(User).where(User.id == user_id))
        user = q.scalar_one_or_none()
        if not user or not user.is_active:
            await websocket.close(code=4401)
            return
        if user_has_any_role(user, UserRole.system_admin):
            await websocket.close(code=4403)
            return
        if token_company is None or str(user.company_id) != str(token_company):
            await websocket.close(code=4401)
            return
        tok_roles = data.get("roles")
        tok_primary = str(data.get("role", ""))
        if tok_roles is None:
            if primary_jwt_role(user).value != tok_primary:
                await websocket.close(code=4401)
                return
        elif not roles_match_token(
            list(user.roles),
            tok_roles if isinstance(tok_roles, list) else None,
            tok_primary,
        ):
            await websocket.close(code=4401)
            return
        company_id = str(user.company_id)

    await websocket.accept()
    _connections.setdefault(company_id, set()).add(websocket)
    try:
        while True:
            _ = await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        _connections.get(company_id, set()).discard(websocket)
