"""Shared issue/receive inventory transaction engine."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Literal, Optional
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import InventoryItem, InventoryMovement, User, Zone
from app.modules.pulse import service as pulse_svc
from app.repositories import inventory_scope_repository as inv_scope_repo
from app.services.inventory_alert_service import maybe_send_low_stock_alert
from app.services.material_request_queue_service import is_item_low_stock, sync_queue_for_inventory_item
from app.schemas.inventory_transactions import (
    InventoryBatchTransactionIn,
    InventoryBatchTransactionOut,
    InventoryTransactionLineIn,
    InventoryTransactionLineOut,
    InventoryTransactionReferenceIn,
    InventoryTransactionSettingsOut,
)

TransactionType = Literal["issue", "receive"]


def _recompute_status(item: InventoryItem) -> None:
    if item.inv_status in ("missing", "maintenance"):
        return
    if item.assigned_user_id:
        item.inv_status = "assigned"
    elif item.low_stock_threshold > 0 and item.quantity <= item.low_stock_threshold:
        item.inv_status = "low_stock"
    else:
        item.inv_status = "in_stock"


async def _sync_stock_queue_and_alerts(db: AsyncSession, item: InventoryItem) -> None:
    await sync_queue_for_inventory_item(db, item)
    await maybe_send_low_stock_alert(db, item, is_low=is_item_low_stock(item))


@dataclass(frozen=True)
class TransactionSettings:
    require_reference: bool = False
    enable_references: bool = False
    enable_batch_transactions: bool = True
    enable_location_selection: bool = True


def transaction_settings_from_inventory_module(settings: dict[str, Any]) -> TransactionSettings:
    from app.core.inventory_module_config import transaction_flags_from_settings

    enable_refs, require_ref, enable_loc = transaction_flags_from_settings(settings)
    raw = settings.get("transactions")
    batch = True
    if isinstance(raw, dict):
        batch = raw.get("enable_batch_transactions", True) is not False
    return TransactionSettings(
        require_reference=require_ref,
        enable_references=enable_refs,
        enable_batch_transactions=batch,
        enable_location_selection=enable_loc,
    )


def transaction_settings_to_out(cfg: TransactionSettings) -> InventoryTransactionSettingsOut:
    return InventoryTransactionSettingsOut(
        require_reference=cfg.require_reference,
        enable_references=cfg.enable_references,
        enable_batch_transactions=cfg.enable_batch_transactions,
        enable_location_selection=cfg.enable_location_selection,
    )


def _reference_present(ref: Optional[InventoryTransactionReferenceIn]) -> bool:
    if ref is None:
        return False
    return bool(
        (ref.reference_type or "").strip()
        or (ref.reference_id or "").strip()
        or (ref.reference_note or "").strip()
    )


def _validate_references(
    cfg: TransactionSettings,
    *,
    batch_ref: Optional[InventoryTransactionReferenceIn],
    lines: list[InventoryTransactionLineIn],
) -> None:
    if not cfg.enable_references:
        return
    if not cfg.require_reference:
        return
    if _reference_present(batch_ref):
        return
    for line in lines:
        if _reference_present(line.reference):
            return
    raise ValueError("A reference is required before confirming this transaction")


def _reference_meta(
    ref: Optional[InventoryTransactionReferenceIn],
    *,
    legacy_notes: Optional[str] = None,
) -> dict[str, Any]:
    meta: dict[str, Any] = {}
    if ref is not None:
        if ref.reference_type and str(ref.reference_type).strip():
            meta["reference_type"] = str(ref.reference_type).strip()
        if ref.reference_id and str(ref.reference_id).strip():
            meta["reference_id"] = str(ref.reference_id).strip()
        if ref.reference_note and str(ref.reference_note).strip():
            meta["reference_note"] = str(ref.reference_note).strip()
    note = (legacy_notes or "").strip()
    if note and "reference_note" not in meta:
        meta["reference_note"] = note
    return meta


async def _resolve_zone(
    db: AsyncSession,
    company_id: str,
    zone_id: Optional[str],
) -> Optional[str]:
    if not zone_id or not str(zone_id).strip():
        return None
    zid = str(zone_id).strip()
    if not await pulse_svc.zone_in_company(db, company_id, zid):
        raise ValueError("Unknown location")
    return zid


async def apply_transaction_line(
    db: AsyncSession,
    *,
    company_id: str,
    user: User,
    policy,
    item: InventoryItem,
    transaction_type: TransactionType,
    quantity: float,
    location_id: Optional[str] = None,
    reference: Optional[InventoryTransactionReferenceIn] = None,
    legacy_notes: Optional[str] = None,
    channel: str = "inventory_transactions",
) -> InventoryTransactionLineOut:
    if not inv_scope_repo.can_write_inventory_item(policy, item):
        raise PermissionError("Inventory write denied")

    qty = float(quantity)
    if qty <= 0:
        raise ValueError("Quantity must be positive")

    before = float(item.quantity or 0)
    zone_id = await _resolve_zone(db, company_id, location_id)

    if transaction_type == "receive":
        after = before + qty
        delta = qty
        action = "scanner_received"
        if zone_id:
            item.zone_id = zone_id
    else:
        after = before - qty
        if after < 0:
            raise ValueError("Insufficient stock for issue")
        delta = -qty
        action = "scanner_issued"
        if zone_id and item.zone_id and str(item.zone_id) != zone_id:
            raise ValueError("Item is not at the selected source location")
        if zone_id and not item.zone_id:
            item.zone_id = zone_id

    item.quantity = after
    _recompute_status(item)
    item.last_movement_at = datetime.now(timezone.utc)

    movement_id = str(uuid4())
    meta = {
        "channel": channel,
        "transaction": transaction_type,
        "quantity_before": before,
        "quantity_after": after,
        "quantity_delta": delta,
        "sku": item.sku,
        "category": item.category,
        "item_type": item.item_type,
        **_reference_meta(reference, legacy_notes=legacy_notes),
    }
    if zone_id:
        meta["location_id"] = zone_id

    db.add(
        InventoryMovement(
            id=movement_id,
            company_id=company_id,
            item_id=item.id,
            action=action,
            performed_by=user.id,
            zone_id=zone_id or item.zone_id,
            quantity=abs(qty),
            meta=meta,
        )
    )

    await _sync_stock_queue_and_alerts(db, item)

    zone_name: Optional[str] = None
    if item.zone_id:
        z = await db.get(Zone, item.zone_id)
        if z:
            zone_name = z.name

    return InventoryTransactionLineOut(
        item_id=item.id,
        sku=item.sku,
        name=item.name,
        quantity=qty,
        transaction_type=transaction_type,
        location_id=zone_id or (str(item.zone_id) if item.zone_id else None),
        location_name=zone_name,
        quantity_before=before,
        quantity_after=after,
        movement_id=movement_id,
    )


async def commit_batch_transaction(
    db: AsyncSession,
    *,
    company_id: str,
    user: User,
    policy,
    body: InventoryBatchTransactionIn,
    module_settings: dict[str, Any],
    channel: str = "inventory_transactions",
) -> InventoryBatchTransactionOut:
    cfg = transaction_settings_from_inventory_module(module_settings)
    if not cfg.enable_batch_transactions and len(body.lines) > 1:
        raise ValueError("Batch transactions are disabled for this organization")
    _validate_references(cfg, batch_ref=body.reference, lines=body.lines)

    tx_type = body.transaction_type
    results: list[InventoryTransactionLineOut] = []
    now = datetime.now(timezone.utc)

    for line in body.lines:
        item = await db.get(InventoryItem, line.item_id)
        if not item or item.company_id != company_id:
            raise ValueError(f"Item not found: {line.item_id}")
        if not inv_scope_repo.can_read_inventory_item(policy, item):
            raise ValueError(f"Item not found: {line.item_id}")

        ref = line.reference
        if ref is None and body.reference is not None:
            ref = body.reference

        out = await apply_transaction_line(
            db,
            company_id=company_id,
            user=user,
            policy=policy,
            item=item,
            transaction_type=tx_type,
            quantity=line.quantity,
            location_id=line.location_id,
            reference=ref if cfg.enable_references else None,
            channel=channel,
        )
        results.append(out)

    return InventoryBatchTransactionOut(
        transaction_type=tx_type,
        lines=results,
        created_at=now,
    )
