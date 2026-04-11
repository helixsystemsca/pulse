"""Login event recording and IP geolocation (best-effort; never blocks auth)."""

from __future__ import annotations

import asyncio
import ipaddress
import json
import logging
import urllib.error
import urllib.parse
import urllib.request
from typing import Optional, Sequence

from fastapi import Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import LoginEvent, User

logger = logging.getLogger(__name__)

_IPAPI_TIMEOUT_SEC = 3.0
_UA_MAX_LEN = 8000


def client_ip(request: Request) -> Optional[str]:
    """Prefer first X-Forwarded-For hop when behind Render / other proxies."""
    xff = request.headers.get("x-forwarded-for")
    if xff:
        first = xff.split(",")[0].strip()
        if first:
            return first
    if request.client and request.client.host:
        return request.client.host
    return None


def _should_geo_lookup(ip: str) -> bool:
    ip = ip.strip()
    if not ip:
        return False
    try:
        addr = ipaddress.ip_address(ip)
        return not (addr.is_private or addr.is_loopback or addr.is_reserved or addr.is_link_local)
    except ValueError:
        return False


def get_location_sync(ip: str) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Resolve city / region / country via ipapi.co.
    Returns (None, None, None) on private IP, error, or non-JSON failure.
    """
    if not _should_geo_lookup(ip):
        return None, None, None
    safe_ip = urllib.parse.quote(ip.strip(), safe=".")
    url = f"https://ipapi.co/{safe_ip}/json/"
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "HelixSystems-Backend/1.0"},
            method="GET",
        )
        with urllib.request.urlopen(req, timeout=_IPAPI_TIMEOUT_SEC) as resp:
            raw = resp.read().decode()
        data = json.loads(raw)
    except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError, ValueError):
        logger.debug("ipapi lookup failed for %s", ip, exc_info=True)
        return None, None, None
    if not isinstance(data, dict) or data.get("error"):
        return None, None, None

    def _nz(val: object) -> Optional[str]:
        if val is None:
            return None
        s = str(val).strip()
        return s or None

    city = _nz(data.get("city"))
    region = _nz(data.get("region")) or _nz(data.get("region_code"))
    country = _nz(data.get("country_name")) or _nz(data.get("country"))
    return city, region, country


async def get_location(ip: str) -> tuple[Optional[str], Optional[str], Optional[str]]:
    return await asyncio.to_thread(get_location_sync, ip)


async def log_login_event(db: AsyncSession, request: Request, user: User) -> None:
    """Persist one login row; swallow errors so auth never fails."""
    try:
        ip = client_ip(request) or ""
        ua_hdr = request.headers.get("user-agent") or request.headers.get("User-Agent") or ""
        ua = (ua_hdr[:_UA_MAX_LEN] if ua_hdr else None) or None
        city, region, country = await get_location(ip)
        ev = LoginEvent(
            user_id=user.id,
            ip_address=(ip[:128] if ip else "unknown"),
            city=(city[:255] if city else None),
            region=(region[:255] if region else None),
            country=(country[:255] if country else None),
            user_agent=ua,
        )
        db.add(ev)
    except Exception:  # noqa: BLE001
        logger.warning("log_login_event failed for user_id=%s", getattr(user, "id", None), exc_info=True)


async def latest_login_event_per_user(
    db: AsyncSession, user_ids: Sequence[str],
) -> dict[str, LoginEvent]:
    """Most recent LoginEvent per user id (for roster / directory summaries)."""
    ids = [str(x) for x in user_ids if x]
    if not ids:
        return {}
    sub = (
        select(LoginEvent.user_id, func.max(LoginEvent.timestamp).label("mx"))
        .where(LoginEvent.user_id.in_(ids))
        .group_by(LoginEvent.user_id)
    ).subquery()
    q = await db.execute(
        select(LoginEvent).join(
            sub,
            (LoginEvent.user_id == sub.c.user_id) & (LoginEvent.timestamp == sub.c.mx),
        )
    )
    out: dict[str, LoginEvent] = {}
    for row in q.scalars().all():
        out[str(row.user_id)] = row
    return out


async def list_recent_login_events(db: AsyncSession, user_id: str, limit: int = 20) -> list[LoginEvent]:
    q = await db.execute(
        select(LoginEvent)
        .where(LoginEvent.user_id == user_id)
        .order_by(LoginEvent.timestamp.desc())
        .limit(limit)
    )
    return list(q.scalars().all())


__all__ = [
    "client_ip",
    "get_location",
    "get_location_sync",
    "latest_login_event_per_user",
    "list_recent_login_events",
    "log_login_event",
]
