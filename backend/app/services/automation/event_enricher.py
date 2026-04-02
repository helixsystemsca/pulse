"""Persist-time enrichment: normalize identifiers, resolve gateway + BLE, heartbeats, unknown-MAC tracking."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.models.automation_engine import AutomationEvent
from app.models.device_hub import AutomationUnknownDevice
from app.services.automation.logging_service import log_event
from app.services.automation.state_manager import load_state, save_state
from app.services.devices.device_service import BLE_EQUIPMENT_TAG, BLE_WORKER_TAG, DeviceService, normalize_mac

logger = logging.getLogger(__name__)

ENRICH_RATE_LIMIT_SECONDS = 0.3

# When True, append secondary `AutomationEvent` rows (`unknown_device_seen`) for auditing (logic modules ignore them).
EMIT_UNKNOWN_DEVICE_AUTOMATION_EVENTS = False

UNKNOWN_DEVICE_EVENT_TYPE = "unknown_device_seen"
PROXIMITY_EVENT = "proximity_update"


@dataclass(frozen=True)
class EnrichResult:
    """If ``process`` is False, skip ``process_event`` (dedup handled before insert; rate limit here)."""

    process: bool
    rate_limited: bool = False


def _rate_gateway_track_key(company_id: str, payload: dict[str, Any]) -> Optional[str]:
    gw = str(payload.get("gateway_id") or "").strip()
    if not gw:
        return None
    return f"__rate_gw:{company_id}:{gw}"[:500]


def _rate_entity_tags_track_key(company_id: str, payload: dict[str, Any]) -> Optional[str]:
    """MAC pair before BLE resolve — different tags on the same gateway stay independent."""
    wm = str(payload.get("worker_tag_mac") or "").strip()[:80]
    em = str(payload.get("equipment_tag_mac") or "").strip()[:80]
    if not wm and not em:
        return None
    return f"__rate_ent:{company_id}:w:{wm}:e:{em}"[:500]


def _within_enrich_window(last_ts: float, now: float) -> bool:
    return last_ts > 0.0 and (now - last_ts) < ENRICH_RATE_LIMIT_SECONDS


async def _enrich_rate_allowed(db: AsyncSession, *, company_id: str, payload: dict[str, Any]) -> bool:
    """
    Two-axis debounce: skip only when **both** gateway and (worker+equipment MAC) axes are hot.

    If either axis is absent (no id in payload), that axis does not contribute — bursts from another
    tag on the same gateway are not suppressed.
    """
    now = time.time()
    gk = _rate_gateway_track_key(company_id, payload)
    ek = _rate_entity_tags_track_key(company_id, payload)

    if gk is None and ek is None:
        return True

    g_within = False
    if gk is not None:
        st_g = await load_state(db, company_id, gk)
        g_within = _within_enrich_window(float(st_g.get("last_enrich_at", 0.0)), now)

    e_within = False
    if ek is not None:
        st_e = await load_state(db, company_id, ek)
        e_within = _within_enrich_window(float(st_e.get("last_enrich_at", 0.0)), now)

    gw_applicable = gk is not None
    ent_applicable = ek is not None
    if gw_applicable and ent_applicable and g_within and e_within:
        return False

    if gk is not None:
        await save_state(db, company_id, gk, {"last_enrich_at": now})
    if ek is not None:
        await save_state(db, company_id, ek, {"last_enrich_at": now})
    return True


async def _touch_unknown_mac(db: AsyncSession, *, company_id: str, mac: str) -> None:
    now = datetime.now(timezone.utc)
    q = await db.execute(
        select(AutomationUnknownDevice).where(
            AutomationUnknownDevice.company_id == company_id,
            AutomationUnknownDevice.mac_address == mac,
        )
    )
    row = q.scalar_one_or_none()
    if row:
        row.last_seen_at = now
        row.seen_count = int(row.seen_count or 0) + 1
    else:
        db.add(
            AutomationUnknownDevice(
                company_id=company_id,
                mac_address=mac,
                first_seen_at=now,
                last_seen_at=now,
                seen_count=1,
            )
        )
    await db.flush()


async def enrich_event(db: AsyncSession, event: AutomationEvent) -> EnrichResult:
    """
    Mutate `event.payload` in place after the row is flushed (has `id`).

    Returns whether downstream ``process_event`` should run (False when rate-limited).
    """
    payload_in = dict(event.payload or {})
    company_id = str(event.company_id or payload_in.get("company_id") or "").strip()
    if not company_id:
        logger.warning("enrich_event: missing company_id on event %s", event.id)
        event.payload = {**payload_in, "enrichment_warnings": ["missing_company_id"]}
        flag_modified(event, "payload")
        return EnrichResult(process=False)

    raw_gateway = payload_in.get("gateway_id")
    if raw_gateway is not None:
        payload_in["source_gateway_id"] = str(raw_gateway)
    if "rssi" in payload_in:
        payload_in["rssi"] = payload_in.get("rssi")

    if not await _enrich_rate_allowed(db, company_id=company_id, payload=payload_in):
        logger.info("enrich_event: rate_limited company=%s event=%s", company_id, event.id)
        payload_in["rate_limited"] = True
        payload_in["company_id"] = company_id
        event.payload = payload_in
        flag_modified(event, "payload")
        await log_event(
            db,
            company_id=company_id,
            log_type="rate_limited",
            message="enrichment rate limited (gateway + tag axes)",
            payload={
                "automation_event_id": event.id,
                "rate_gateway_key": _rate_gateway_track_key(company_id, payload_in),
                "rate_entity_key": _rate_entity_tags_track_key(company_id, payload_in),
            },
            severity="info",
            source_module="enrichment",
        )
        return EnrichResult(process=False, rate_limited=True)

    payload_in["company_id"] = company_id
    warnings: list[str] = []
    svc = DeviceService(db)

    gateway_id_raw = payload_in.get("gateway_id")
    if gateway_id_raw:
        gw = await svc.get_gateway(company_id=company_id, gateway_id=str(gateway_id_raw))
        if gw:
            payload_in["gateway_id"] = str(gw.id)
            gw.last_seen_at = datetime.now(timezone.utc)
            gw.status = "online"
            await db.flush()
            if event.event_type == PROXIMITY_EVENT:
                if gw.zone_id:
                    payload_in["zone_id"] = gw.zone_id
                else:
                    logger.warning(
                        "enrich_event: gateway %s has no zone_id (company=%s event=%s)",
                        gw.id,
                        company_id,
                        event.id,
                    )
        else:
            warnings.append("unknown_gateway")
            logger.warning(
                "enrich_event: unknown gateway_id=%s company=%s event=%s",
                gateway_id_raw,
                company_id,
                event.id,
            )

    if event.event_type != PROXIMITY_EVENT:
        if warnings:
            payload_in["enrichment_warnings"] = warnings
            await log_event(
                db,
                company_id=company_id,
                log_type="enrichment_warnings",
                message=";".join(warnings),
                payload={"warnings": warnings, "automation_event_id": event.id},
                severity="warning",
                source_module="enrichment",
            )
        event.payload = payload_in
        flag_modified(event, "payload")
        return EnrichResult(process=True)

    unknown_for_audit: list[dict[str, str]] = []

    wid_mac = payload_in.get("worker_tag_mac")
    if wid_mac:
        try:
            mac_w = normalize_mac(str(wid_mac))
        except ValueError:
            warnings.append("invalid_worker_tag_mac")
            logger.warning(
                "enrich_event: invalid worker_tag_mac company=%s event=%s",
                company_id,
                event.id,
            )
            mac_w = ""
        if mac_w:
            tag = await svc.get_ble_by_mac(company_id=company_id, mac=mac_w)
            if not tag:
                warnings.append("worker_tag_not_found")
                logger.warning(
                    "enrich_event: worker MAC not registered mac=%s company=%s event=%s",
                    mac_w,
                    company_id,
                    event.id,
                )
                await _touch_unknown_mac(db, company_id=company_id, mac=mac_w)
                await log_event(
                    db,
                    company_id=company_id,
                    log_type="unknown_device",
                    message="unregistered worker_tag MAC",
                    payload={"mac_address": mac_w, "automation_event_id": event.id},
                    severity="warning",
                    source_module="enrichment",
                )
                unknown_for_audit.append({"role": "worker_tag", "mac_address": mac_w})
            elif tag.type != BLE_WORKER_TAG:
                warnings.append("worker_tag_mac_wrong_type")
                logger.warning(
                    "enrich_event: BLE type mismatch for worker mac=%s company=%s event=%s",
                    mac_w,
                    company_id,
                    event.id,
                )
            elif not tag.assigned_worker_id:
                warnings.append("worker_tag_unassigned")
                logger.warning(
                    "enrich_event: worker tag unassigned mac=%s company=%s event=%s",
                    mac_w,
                    company_id,
                    event.id,
                )
            else:
                payload_in["worker_id"] = tag.assigned_worker_id

    eid_mac = payload_in.get("equipment_tag_mac")
    if eid_mac:
        try:
            mac_e = normalize_mac(str(eid_mac))
        except ValueError:
            warnings.append("invalid_equipment_tag_mac")
            logger.warning(
                "enrich_event: invalid equipment_tag_mac company=%s event=%s",
                company_id,
                event.id,
            )
            mac_e = ""
        if mac_e:
            tag = await svc.get_ble_by_mac(company_id=company_id, mac=mac_e)
            if not tag:
                warnings.append("equipment_tag_not_found")
                logger.warning(
                    "enrich_event: equipment MAC not registered mac=%s company=%s event=%s",
                    mac_e,
                    company_id,
                    event.id,
                )
                await _touch_unknown_mac(db, company_id=company_id, mac=mac_e)
                await log_event(
                    db,
                    company_id=company_id,
                    log_type="unknown_device",
                    message="unregistered equipment_tag MAC",
                    payload={"mac_address": mac_e, "automation_event_id": event.id},
                    severity="warning",
                    source_module="enrichment",
                )
                unknown_for_audit.append({"role": "equipment_tag", "mac_address": mac_e})
            elif tag.type != BLE_EQUIPMENT_TAG:
                warnings.append("equipment_tag_mac_wrong_type")
                logger.warning(
                    "enrich_event: BLE type mismatch for equipment mac=%s company=%s event=%s",
                    mac_e,
                    company_id,
                    event.id,
                )
            elif not tag.assigned_equipment_id:
                warnings.append("equipment_tag_unassigned")
                logger.warning(
                    "enrich_event: equipment tag unassigned mac=%s company=%s event=%s",
                    mac_e,
                    company_id,
                    event.id,
                )
            else:
                payload_in["equipment_id"] = tag.assigned_equipment_id

    if warnings:
        payload_in["enrichment_warnings"] = warnings
        await log_event(
            db,
            company_id=company_id,
            log_type="enrichment_warnings",
            message=";".join(warnings),
            payload={"warnings": warnings, "automation_event_id": event.id},
            severity="warning",
            source_module="enrichment",
        )

    if EMIT_UNKNOWN_DEVICE_AUTOMATION_EVENTS and unknown_for_audit:
        audit = AutomationEvent(
            company_id=company_id,
            event_type=UNKNOWN_DEVICE_EVENT_TYPE,
            payload={
                "parent_automation_event_id": event.id,
                "observations": unknown_for_audit,
            },
        )
        db.add(audit)
        await db.flush()

    event.payload = payload_in
    flag_modified(event, "payload")
    return EnrichResult(process=True)
