"""
Advanced inventory under `/api/inventory` — items, movements, usage, work-request deduction, settings.

Multi-tenant with optional `company_id` for system administrators.
"""

from __future__ import annotations

import copy
import logging
from datetime import datetime, timezone
from typing import Annotated, Any, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from starlette.responses import Response
from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.api.deps import get_current_user, get_db, require_any_rbac
from app.core.inventory.policy import (
    EffectiveInventoryPolicy,
    inventory_department_slugs_for_user,
    resolve_effective_inventory_policy,
)
from app.core.permission_feature_matrix import permission_matrix_department_for_user
from app.models.pulse_models import PulseWorkerHR
from app.core.user_roles import user_has_any_role
from app.models.domain import (
    Company,
    InventoryContractor,
    InventoryItem,
    InventoryModuleSettings,
    InventoryMovement,
    InventoryScope,
    InventoryUsage,
    InventoryVendor,
    Tool,
    User,
    UserRole,
    Zone,
)
from app.api.inventory_query_helpers import (
    collect_item_reference_ids,
    ctx_maps_for_ids,
    last_used_at_map,
)
from app.core.tenant_context import resolve_tenant_company_id
from app.core.tenant_departments import list_tenant_departments, validate_tenant_department_slug
from app.core.pulse_storage import (
    read_inventory_item_image_bytes,
    stored_object_display_url,
    write_inventory_item_image_bytes,
)
from app.repositories import inventory_scope_repository as inv_scope_repo
from app.schemas.inventory_transactions import (
    InventoryBatchTransactionIn,
    InventoryBatchTransactionOut,
    InventoryTransactionLineIn,
    InventoryTransactionReferenceIn,
    InventoryTransactionSettingsOut,
)
from app.core.operational_notifications import patch_inventory_low_stock
from app.services.inventory_alert_service import maybe_send_low_stock_alert
from app.services.inventory_notifications import notifications_from_settings
from app.services.inventory_transaction_service import (
    _validate_references,
    apply_transaction_line,
    commit_batch_transaction,
    transaction_settings_from_inventory_module,
    transaction_settings_to_out,
)
from app.services.inventory_low_stock import is_item_low_stock
from app.services.inventory_replenishment_metrics_service import compute_replenishment_analytics
from app.services.material_request_queue_service import (
    inventory_item_ids_mr_on_order,
    sync_queue_for_inventory_item,
)
from app.models.pulse_models import PulseWorkRequest
from app.modules.pulse import service as pulse_svc
from app.schemas.inventory_portal import (
    InventoryAssignIn,
    InventoryCreateIn,
    InventoryDetailOut,
    InventoryImageUploadOut,
    InventoryListOut,
    InventoryMoveIn,
    InventoryMovementOut,
    InventoryPatchIn,
    InventoryRowOut,
    InventoryScopeRowOut,
    InventorySettingsOut,
    InventorySettingsPatchIn,
    InventoryReplenishmentMetricsOut,
    InventoryReplenishmentYoyOut,
    InventorySummaryOut,
    InventoryTopUsedOut,
    InventoryUseIn,
    InventoryUsageOut,
    InventoryContractorCreateIn,
    InventoryContractorOut,
    InventoryContractorPatchIn,
    InventoryVendorCreateIn,
    InventoryVendorOut,
    InventoryVendorPatchIn,
    InventoryScanLookupOut,
    InventoryScanTransactionIn,
    InventoryScanTransactionOut,
)

router = APIRouter(prefix="/inventory", tags=["inventory"])
_log = logging.getLogger(__name__)

_MAX_ITEM_IMAGE_BYTES = 5 * 1024 * 1024
_ITEM_IMAGE_CT_EXT: dict[str, str] = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def _inventory_image_internal_url(item_id: str) -> str:
    return f"/api/inventory/{item_id}/image"


async def _get_inventory_item_for_company(
    db: AsyncSession,
    cid: str,
    policy: EffectiveInventoryPolicy,
    item_id: str,
    *,
    write: bool = False,
) -> InventoryItem:
    item = await db.get(InventoryItem, item_id)
    if not item or item.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    if not inv_scope_repo.can_read_inventory_item(policy, item):
        raise HTTPException(status_code=404, detail="Not found")
    if write and not inv_scope_repo.can_write_inventory_item(policy, item):
        raise HTTPException(status_code=403, detail="Inventory write denied")
    return item


async def _save_inventory_item_image_upload(file: UploadFile, company_id: str, item_id: str):
    ct = (file.content_type or "").split(";")[0].strip().lower()
    if ct not in _ITEM_IMAGE_CT_EXT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upload a JPEG, PNG, or WebP image (max 5MB)",
        )
    raw = await file.read()
    if len(raw) > _MAX_ITEM_IMAGE_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image too large (max 5MB)")
    ext = _ITEM_IMAGE_CT_EXT[ct]
    try:
        return await write_inventory_item_image_bytes(company_id, item_id, ext, raw, ct)
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)) from e


async def _normalize_department_slug(db: AsyncSession, cid: str, raw: str) -> str:
    try:
        return await validate_tenant_department_slug(db, cid, raw)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


DEFAULT_INVENTORY_SETTINGS: dict[str, Any] = {
    "setup_completed": False,
    "categories": ["Tool", "Part", "Consumable", "Fasteners", "Electrical"],
    "register_form": {
        "subtitle": "Tools are individually tracked; parts and consumables use quantity.",
        "fields": [],
    },
    "status_rules": {},
    "threshold_defaults": {"default_min": 5},
    "locations": [],
    "assignment_rules": {"checkout_required": True},
    "alerts": {"low_stock": True, "missing": True},
    "transactions": {
        "require_reference": False,
        "enable_references": False,
        "enable_batch_transactions": True,
        "enable_location_selection": True,
    },
    "inventory": {
        "asset_types": ["consumables", "tools", "materials"],
        "location_mode": "single",
        "enable_shelf": False,
        "procurement_mode": "excel",
        "procurement_action_label": "Export Request",
        "reference_mode": "none",
        "approval_mode": "none",
    },
    "notifications": {
        "email_directory": [],
        "low_stock_enabled": True,
        "low_stock_emails": [],
        "mr_export_emails": [],
    },
    "purchasing": {
        "enabled": True,
        "enable_replenishment_requests": True,
        "enable_quick_purchases": True,
        "enable_receipt_uploads": True,
        "enable_vendor_tracking": True,
        "enable_contract_archive": False,
        "enable_purchase_history": True,
        "enable_monthly_expense_exports": True,
        "require_vendor_selection": False,
        "require_receipt_upload": False,
        "purchasing_label": "Purchasing",
        "replenishment_label": "Replenishment Queue",
    },
}


def merge_inventory_settings(raw: Optional[dict[str, Any]]) -> dict[str, Any]:
    out = copy.deepcopy(DEFAULT_INVENTORY_SETTINGS)
    if not raw:
        return out
    for k, v in raw.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            merged = dict(out[k])
            merged.update(v)
            out[k] = merged
        else:
            out[k] = v
    if raw.get("setup_completed") is True:
        out["setup_completed"] = True
    elif raw.get("categories") and raw.get("setup_completed") is None:
        out["setup_completed"] = True
    return out


async def resolve_inv_company_id(
    user: Annotated[User, Depends(get_current_user)],
    company_id: Optional[str] = Query(None, description="Required for system administrators"),
) -> str:
    return resolve_tenant_company_id(user, company_id, path="/api/inventory")


CompanyId = Annotated[str, Depends(resolve_inv_company_id)]
Db = Annotated[AsyncSession, Depends(get_db)]
InvUser = Annotated[User, Depends(require_any_rbac("inventory.view", "inventory.manage", "inventory.scan"))]
InvManageUser = Annotated[User, Depends(require_any_rbac("inventory.manage", "inventory.scan"))]
InvSettingsWriter = Annotated[
    User,
    Depends(require_any_rbac("inventory.view", "inventory.manage", "inventory.scan")),
]
InvScanUser = Annotated[User, Depends(require_any_rbac("inventory.scan", "inventory.manage"))]


async def resolve_inventory_policy(
    db: Db,
    user: Annotated[User, Depends(get_current_user)],
    cid: CompanyId,
) -> EffectiveInventoryPolicy:
    return await resolve_effective_inventory_policy(db, user, cid)


InventoryPolicyDep = Annotated[EffectiveInventoryPolicy, Depends(resolve_inventory_policy)]


async def _validated_explicit_scope_id(
    db: AsyncSession,
    cid: str,
    policy: EffectiveInventoryPolicy,
    raw: Optional[str],
) -> Optional[str]:
    if raw is None or not str(raw).strip():
        return None
    sid = str(raw).strip()
    sc = await inv_scope_repo.get_inventory_scope(db, sid, cid)
    if sc is None:
        raise HTTPException(status_code=400, detail="Unknown inventory scope")
    if policy.is_company_admin:
        return sid
    if sid not in policy.readable_scope_ids:
        raise HTTPException(status_code=403, detail="Inventory scope access denied")
    return sid


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


async def _log_movement(
    db: AsyncSession,
    *,
    company_id: str,
    item_id: str,
    action: str,
    performed_by: Optional[str],
    zone_id: Optional[str] = None,
    quantity: Optional[float] = None,
    work_request_id: Optional[str] = None,
    meta: Optional[dict[str, Any]] = None,
) -> None:
    db.add(
        InventoryMovement(
            id=str(uuid4()),
            company_id=company_id,
            item_id=item_id,
            action=action,
            performed_by=performed_by,
            zone_id=zone_id,
            quantity=quantity,
            work_request_id=work_request_id,
            meta=dict(meta or {}),
        )
    )


LOCATION_STOCK_KEY = "location_stock"


def _parse_location_stock(attrs: Optional[dict[str, Any]]) -> list[tuple[str, float]]:
    raw = (attrs or {}).get(LOCATION_STOCK_KEY)
    if not isinstance(raw, list):
        return []
    merged: dict[str, float] = {}
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        zid = str(entry.get("zone_id") or "").strip()
        if not zid:
            continue
        try:
            qty = float(entry.get("quantity") or 0)
        except (TypeError, ValueError):
            qty = 0.0
        if qty <= 0:
            continue
        merged[zid] = merged.get(zid, 0.0) + qty
    return [(zid, qty) for zid, qty in merged.items()]


def _location_name_for_item(item: InventoryItem, zones: dict[str, Zone]) -> Optional[str]:
    lines = _parse_location_stock(item.custom_attributes)
    if lines:
        if len(lines) == 1:
            z = zones.get(lines[0][0])
            return z.name if z else None
        parts: list[str] = []
        for zid, qty in lines:
            z = zones.get(zid)
            label = z.name if z else "Location"
            parts.append(f"{label} ({qty:g})")
        return ", ".join(parts)
    z = zones.get(str(item.zone_id)) if item.zone_id else None
    return z.name if z else None


async def _assert_inventory_storage_zone(db: AsyncSession, cid: str, zone_id: str) -> None:
    """Reject schedule facilities and unknown zones for inventory stock location."""
    z = await db.get(Zone, zone_id)
    if not z or str(z.company_id) != cid:
        raise HTTPException(status_code=400, detail="Unknown location")
    meta = z.meta if isinstance(z.meta, dict) else {}
    if meta.get("schedule_facility") is True:
        raise HTTPException(
            status_code=400,
            detail="That location is used for workforce scheduling, not inventory storage. Add storage locations in Inventory setup.",
        )


async def _normalize_location_lines(
    db: AsyncSession,
    cid: str,
    lines: list[tuple[str, float]],
) -> list[tuple[str, float]]:
    merged: dict[str, float] = {}
    for zid, qty in lines:
        z = str(zid).strip()
        if not z or qty <= 0:
            continue
        await _assert_inventory_storage_zone(db, cid, z)
        merged[z] = merged.get(z, 0.0) + float(qty)
    return [(z, q) for z, q in merged.items()]


def _apply_location_stock(
    item: InventoryItem,
    lines: list[tuple[str, float]],
    *,
    custom_attributes: Optional[dict[str, Any]] = None,
) -> None:
    attrs = dict(custom_attributes if custom_attributes is not None else (item.custom_attributes or {}))
    if lines:
        attrs[LOCATION_STOCK_KEY] = [{"zone_id": zid, "quantity": qty} for zid, qty in lines]
        item.quantity = sum(qty for _, qty in lines)
        item.zone_id = lines[0][0]
    else:
        attrs.pop(LOCATION_STOCK_KEY, None)
    item.custom_attributes = attrs


def _row(
    item: InventoryItem,
    *,
    users: dict[str, User],
    zones: dict[str, Zone],
    tools: dict[str, Tool],
    last_used: Optional[datetime],
    mr_on_order: bool = False,
) -> InventoryRowOut:
    au = users.get(str(item.assigned_user_id)) if item.assigned_user_id else None
    t = tools.get(str(item.linked_tool_id)) if item.linked_tool_id else None
    return InventoryRowOut(
        id=item.id,
        sku=item.sku,
        name=item.name,
        item_type=item.item_type,
        category=item.category,
        inv_status=item.inv_status,
        mr_on_order=mr_on_order,
        quantity=item.quantity,
        unit=item.unit,
        low_stock_threshold=item.low_stock_threshold,
        assigned_user_id=item.assigned_user_id,
        assignee_name=au.full_name if au else None,
        zone_id=item.zone_id,
        location_name=_location_name_for_item(item, zones),
        linked_tool_id=item.linked_tool_id,
        linked_asset_name=t.name if t else None,
        condition=item.item_condition,
        department_slug=item.department_slug,
        scope_id=item.scope_id,
        reorder_flag=item.reorder_flag,
        last_movement_at=item.last_movement_at,
        last_used_at=last_used,
        usage_count=item.usage_count,
        unit_cost=item.unit_cost,
        vendor=item.vendor,
        image_url=item.image_url,
        custom_attributes=dict(item.custom_attributes or {}),
    )


async def _inventory_detail_payload(db: AsyncSession, cid: str, item: InventoryItem) -> InventoryDetailOut:
    movement_rows = list(
        (
            await db.execute(
                select(InventoryMovement)
                .where(InventoryMovement.item_id == item.id)
                .order_by(InventoryMovement.created_at.desc())
                .limit(80)
            )
        ).scalars().all()
    )
    usage_rows = list(
        (
            await db.execute(
                select(InventoryUsage)
                .where(InventoryUsage.item_id == item.id)
                .order_by(InventoryUsage.created_at.desc())
                .limit(50)
            )
        ).scalars().all()
    )

    user_ids, zone_ids, tool_ids = collect_item_reference_ids([item])
    wr_ids: set[str] = set()
    for m in movement_rows:
        if m.performed_by:
            user_ids.add(str(m.performed_by))
        if m.zone_id:
            zone_ids.add(str(m.zone_id))
        if m.work_request_id:
            wr_ids.add(str(m.work_request_id))
    for u in usage_rows:
        if u.work_request_id:
            wr_ids.add(str(u.work_request_id))

    users, zones, tools = await ctx_maps_for_ids(
        db, cid, user_ids=user_ids, zone_ids=zone_ids, tool_ids=tool_ids
    )
    last_used = (await last_used_at_map(db, [str(item.id)])).get(str(item.id))
    mr_ids = await inventory_item_ids_mr_on_order(db, cid)
    base = _row(
        item,
        users=users,
        zones=zones,
        tools=tools,
        last_used=last_used,
        mr_on_order=str(item.id) in mr_ids,
    )

    wr_map: dict[str, PulseWorkRequest] = {}
    if wr_ids:
        wq = await db.execute(
            select(PulseWorkRequest).where(
                PulseWorkRequest.company_id == cid,
                PulseWorkRequest.id.in_(list(wr_ids)),
            )
        )
        wr_map = {str(w.id): w for w in wq.scalars().all()}

    movements: list[InventoryMovementOut] = []
    for m in movement_rows:
        pu = users.get(str(m.performed_by)) if m.performed_by else None
        zn = zones.get(str(m.zone_id)).name if m.zone_id and str(m.zone_id) in zones else None
        wlabel = None
        if m.work_request_id:
            w = wr_map.get(str(m.work_request_id))
            wlabel = w.title[:80] if w else None
        movements.append(
            InventoryMovementOut(
                id=m.id,
                action=m.action,
                performed_by=m.performed_by,
                performer_name=pu.full_name if pu else None,
                zone_id=m.zone_id,
                zone_name=zn,
                quantity=m.quantity,
                work_request_id=m.work_request_id,
                work_request_label=wlabel,
                meta=dict(m.meta or {}),
                created_at=m.created_at,
            )
        )

    usage_out: list[InventoryUsageOut] = []
    for u in usage_rows:
        w = wr_map.get(str(u.work_request_id)) if u.work_request_id else None
        usage_out.append(
            InventoryUsageOut(
                id=u.id,
                work_request_id=u.work_request_id,
                work_request_title=w.title if w else None,
                quantity=u.quantity,
                created_at=u.created_at,
            )
        )

    linked_wr = [{"id": w.id, "title": w.title} for w in wr_map.values()]

    return InventoryDetailOut(
        **base.model_dump(),
        movements=movements,
        usage=usage_out,
        linked_work_requests=linked_wr,
    )


async def _get_settings_row(db: AsyncSession, cid: str) -> Optional[InventoryModuleSettings]:
    q = await db.execute(select(InventoryModuleSettings).where(InventoryModuleSettings.company_id == cid))
    return q.scalar_one_or_none()


@router.get("/settings", response_model=InventorySettingsOut)
async def get_inv_settings(db: Db, _: InvUser, cid: CompanyId) -> InventorySettingsOut:
    row = await _get_settings_row(db, cid)
    return InventorySettingsOut(settings=merge_inventory_settings(row.settings if row else None))


@router.patch("/settings", response_model=InventorySettingsOut)
async def patch_inv_settings(
    db: Db,
    _: InvSettingsWriter,
    cid: CompanyId,
    body: InventorySettingsPatchIn,
) -> InventorySettingsOut:
    row = await _get_settings_row(db, cid)
    stored = dict(row.settings) if row and isinstance(row.settings, dict) else {}
    base = merge_inventory_settings(stored if stored else None)
    for k, v in body.settings.items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            m = dict(base[k])
            m.update(v)
            base[k] = m
        else:
            base[k] = v
    if "setup_completed" in body.settings:
        base["setup_completed"] = bool(body.settings["setup_completed"])
    if row:
        row.settings = base
        flag_modified(row, "settings")
    else:
        db.add(InventoryModuleSettings(id=str(uuid4()), company_id=cid, settings=base))

    notif = notifications_from_settings(base)
    if notif.email_directory:
        co = await db.get(Company, cid)
        if co is not None:
            co.operational_notifications = patch_inventory_low_stock(
                getattr(co, "operational_notifications", None),
                enabled=notif.low_stock_enabled,
                emails=notif.low_stock_emails or notif.email_directory,
            )

    await db.commit()
    return InventorySettingsOut(settings=base)


async def _resolve_directory_department_slug(
    db: AsyncSession,
    user: User,
    policy: EffectiveInventoryPolicy,
    cid: str,
    requested: Optional[str],
) -> str:
    configured = await list_tenant_departments(db, cid)
    configured_slugs = {r.slug for r in configured}

    if requested and str(requested).strip():
        ds = await _normalize_department_slug(db, cid, str(requested))
        if not policy.is_company_admin:
            allowed = await inventory_department_slugs_for_user(db, user, cid)
            if ds not in allowed:
                raise HTTPException(status_code=403, detail="Department access denied")
        return ds

    if configured_slugs:
        if policy.is_company_admin:
            return configured[0].slug
        allowed = await inventory_department_slugs_for_user(db, user, cid)
        overlap = [s for s in configured if s.slug in allowed]
        if len(overlap) == 1:
            return overlap[0].slug
        if overlap:
            return overlap[0].slug
        hr_row = await db.execute(select(PulseWorkerHR).where(PulseWorkerHR.user_id == user.id))
        hr = hr_row.scalar_one_or_none()
        matrix_slug = permission_matrix_department_for_user(user, hr)
        if matrix_slug and matrix_slug in configured_slugs:
            return matrix_slug
        raise HTTPException(status_code=403, detail="Department access denied")

    raise HTTPException(
        status_code=400,
        detail="Add at least one department in Inventory setup (wizard or Settings → Departments) before assigning items.",
    )


async def _apply_directory_department_filter(
    db: AsyncSession,
    user: User,
    policy: EffectiveInventoryPolicy,
    cid: str,
    conds: list[Any],
    model: type,
    department_slug: Optional[str],
) -> None:
    if policy.is_company_admin:
        if department_slug and department_slug.strip():
            conds.append(
                model.department_slug
                == await _normalize_department_slug(db, cid, department_slug)
            )
        return
    allowed = await inventory_department_slugs_for_user(db, user, cid)
    if department_slug and department_slug.strip():
        ds = await _normalize_department_slug(db, cid, department_slug)
        if ds not in allowed:
            raise HTTPException(status_code=403, detail="Department access denied")
        conds.append(model.department_slug == ds)
    elif len(allowed) == 1:
        conds.append(
            model.department_slug
            == await _normalize_department_slug(db, cid, next(iter(allowed)))
        )
    else:
        normed = [await _normalize_department_slug(db, cid, s) for s in allowed]
        conds.append(model.department_slug.in_(normed))


def _vendor_ilike(column: Any, raw: Optional[str]) -> Optional[Any]:
    if raw is None:
        return None
    t = raw.strip()
    if not t:
        return None
    pat = "%" + t.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
    return column.ilike(pat, escape="\\")


@router.get("/vendors", response_model=list[InventoryVendorOut])
async def list_inventory_vendors(
    db: Db,
    user: InvUser,
    cid: CompanyId,
    policy: InventoryPolicyDep,
    department_slug: Optional[str] = Query(None, description="Filter by workspace department slug"),
    name_contains: Optional[str] = Query(None),
    contact_name_contains: Optional[str] = Query(None),
    contact_email_contains: Optional[str] = Query(None),
    contact_phone_contains: Optional[str] = Query(None),
    account_number_contains: Optional[str] = Query(None),
    payment_terms_contains: Optional[str] = Query(None),
    item_specialty_contains: Optional[str] = Query(None),
    notes_contains: Optional[str] = Query(None),
    website_contains: Optional[str] = Query(None),
    address_line1_contains: Optional[str] = Query(None),
    address_line2_contains: Optional[str] = Query(None),
    city_contains: Optional[str] = Query(None),
    region_contains: Optional[str] = Query(None),
    postal_code_contains: Optional[str] = Query(None),
    country_contains: Optional[str] = Query(None),
    active: Optional[bool] = Query(None, description="True = active only, False = inactive only, omit = all"),
    limit: int = Query(500, ge=1, le=1000),
) -> list[InventoryVendorOut]:
    conds: list[Any] = [InventoryVendor.company_id == cid]
    field_filters = [
        (InventoryVendor.name, name_contains),
        (InventoryVendor.contact_name, contact_name_contains),
        (InventoryVendor.contact_email, contact_email_contains),
        (InventoryVendor.contact_phone, contact_phone_contains),
        (InventoryVendor.account_number, account_number_contains),
        (InventoryVendor.payment_terms, payment_terms_contains),
        (InventoryVendor.item_specialty, item_specialty_contains),
        (InventoryVendor.notes, notes_contains),
        (InventoryVendor.website, website_contains),
        (InventoryVendor.address_line1, address_line1_contains),
        (InventoryVendor.address_line2, address_line2_contains),
        (InventoryVendor.city, city_contains),
        (InventoryVendor.region, region_contains),
        (InventoryVendor.postal_code, postal_code_contains),
        (InventoryVendor.country, country_contains),
    ]
    for col, term in field_filters:
        clause = _vendor_ilike(col, term)
        if clause is not None:
            conds.append(clause)
    if active is not None:
        conds.append(InventoryVendor.is_active.is_(bool(active)))
    await _apply_directory_department_filter(db, user, policy, cid, conds, InventoryVendor, department_slug)

    stmt = (
        select(InventoryVendor)
        .where(and_(*conds))
        .order_by(InventoryVendor.name.asc())
        .limit(limit)
    )
    rows = list((await db.execute(stmt)).scalars().all())
    return [InventoryVendorOut.model_validate(r) for r in rows]


@router.post("/vendors", response_model=InventoryVendorOut, status_code=status.HTTP_201_CREATED)
async def create_inventory_vendor(
    db: Db,
    user: InvUser,
    cid: CompanyId,
    policy: InventoryPolicyDep,
    body: InventoryVendorCreateIn,
) -> InventoryVendorOut:
    dept = await _resolve_directory_department_slug(db, user, policy, cid, body.department_slug)
    now = datetime.now(timezone.utc)
    row = InventoryVendor(
        id=str(uuid4()),
        company_id=cid,
        department_slug=dept,
        name=body.name.strip(),
        contact_name=(body.contact_name or "").strip() or None,
        contact_email=(body.contact_email or "").strip() or None,
        contact_phone=(body.contact_phone or "").strip() or None,
        account_number=(body.account_number or "").strip() or None,
        payment_terms=(body.payment_terms or "").strip() or None,
        item_specialty=(body.item_specialty or "").strip() or None,
        notes=(body.notes or "").strip() or None,
        website=(body.website or "").strip() or None,
        address_line1=(body.address_line1 or "").strip() or None,
        address_line2=(body.address_line2 or "").strip() or None,
        city=(body.city or "").strip() or None,
        region=(body.region or "").strip() or None,
        postal_code=(body.postal_code or "").strip() or None,
        country=(body.country or "").strip() or None,
        is_active=bool(body.is_active),
        preferred_vendor=bool(body.preferred_vendor),
        lead_time_days=body.lead_time_days,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return InventoryVendorOut.model_validate(row)


@router.patch("/vendors/{vendor_id}", response_model=InventoryVendorOut)
async def patch_inventory_vendor(
    db: Db,
    user: InvUser,
    cid: CompanyId,
    policy: InventoryPolicyDep,
    vendor_id: str,
    body: InventoryVendorPatchIn,
) -> InventoryVendorOut:
    row = await db.get(InventoryVendor, vendor_id)
    if not row or row.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    if not policy.is_company_admin:
        allowed = await inventory_department_slugs_for_user(db, user, cid)
        if row.department_slug not in allowed:
            raise HTTPException(status_code=403, detail="Department access denied")
    data = body.model_dump(exclude_unset=True)
    if "department_slug" in data and data["department_slug"] is not None:
        row.department_slug = await _resolve_directory_department_slug(
            db, user, policy, cid, str(data.pop("department_slug"))
        )
    if "name" in data and data["name"] is not None:
        row.name = str(data["name"]).strip()
    str_fields = (
        "contact_name",
        "contact_email",
        "contact_phone",
        "account_number",
        "payment_terms",
        "item_specialty",
        "notes",
        "website",
        "address_line1",
        "address_line2",
        "city",
        "region",
        "postal_code",
        "country",
    )
    for k in str_fields:
        if k not in data:
            continue
        v = data[k]
        setattr(row, k, None if v is None else (str(v).strip() or None))
    if "is_active" in data and data["is_active"] is not None:
        row.is_active = bool(data["is_active"])
    if "preferred_vendor" in data and data["preferred_vendor"] is not None:
        row.preferred_vendor = bool(data["preferred_vendor"])
    if "lead_time_days" in data:
        row.lead_time_days = data["lead_time_days"]
    row.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(row)
    return InventoryVendorOut.model_validate(row)


@router.delete("/vendors/{vendor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_inventory_vendor(
    db: Db,
    user: InvUser,
    cid: CompanyId,
    policy: InventoryPolicyDep,
    vendor_id: str,
) -> None:
    row = await db.get(InventoryVendor, vendor_id)
    if not row or row.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    if not policy.is_company_admin:
        allowed = await inventory_department_slugs_for_user(db, user, cid)
        if row.department_slug not in allowed:
            raise HTTPException(status_code=403, detail="Department access denied")
    await db.execute(delete(InventoryVendor).where(InventoryVendor.id == vendor_id))
    await db.commit()


@router.get("/contractors", response_model=list[InventoryContractorOut])
async def list_inventory_contractors(
    db: Db,
    user: InvUser,
    cid: CompanyId,
    policy: InventoryPolicyDep,
    department_slug: Optional[str] = Query(None, description="Filter by workspace department slug"),
    name_contains: Optional[str] = Query(None),
    contact_name_contains: Optional[str] = Query(None),
    contact_email_contains: Optional[str] = Query(None),
    contact_phone_contains: Optional[str] = Query(None),
    account_number_contains: Optional[str] = Query(None),
    payment_terms_contains: Optional[str] = Query(None),
    item_specialty_contains: Optional[str] = Query(None),
    notes_contains: Optional[str] = Query(None),
    website_contains: Optional[str] = Query(None),
    address_line1_contains: Optional[str] = Query(None),
    address_line2_contains: Optional[str] = Query(None),
    city_contains: Optional[str] = Query(None),
    region_contains: Optional[str] = Query(None),
    postal_code_contains: Optional[str] = Query(None),
    country_contains: Optional[str] = Query(None),
    active: Optional[bool] = Query(None, description="True = active only, False = inactive only, omit = all"),
    limit: int = Query(500, ge=1, le=1000),
) -> list[InventoryContractorOut]:
    conds: list[Any] = [InventoryContractor.company_id == cid]
    field_filters = [
        (InventoryContractor.name, name_contains),
        (InventoryContractor.contact_name, contact_name_contains),
        (InventoryContractor.contact_email, contact_email_contains),
        (InventoryContractor.contact_phone, contact_phone_contains),
        (InventoryContractor.account_number, account_number_contains),
        (InventoryContractor.payment_terms, payment_terms_contains),
        (InventoryContractor.item_specialty, item_specialty_contains),
        (InventoryContractor.notes, notes_contains),
        (InventoryContractor.website, website_contains),
        (InventoryContractor.address_line1, address_line1_contains),
        (InventoryContractor.address_line2, address_line2_contains),
        (InventoryContractor.city, city_contains),
        (InventoryContractor.region, region_contains),
        (InventoryContractor.postal_code, postal_code_contains),
        (InventoryContractor.country, country_contains),
    ]
    for col, term in field_filters:
        clause = _vendor_ilike(col, term)
        if clause is not None:
            conds.append(clause)
    if active is not None:
        conds.append(InventoryContractor.is_active.is_(bool(active)))
    await _apply_directory_department_filter(db, user, policy, cid, conds, InventoryContractor, department_slug)

    stmt = (
        select(InventoryContractor)
        .where(and_(*conds))
        .order_by(InventoryContractor.name.asc())
        .limit(limit)
    )
    rows = list((await db.execute(stmt)).scalars().all())
    return [InventoryContractorOut.model_validate(r) for r in rows]


@router.post("/contractors", response_model=InventoryContractorOut, status_code=status.HTTP_201_CREATED)
async def create_inventory_contractor(
    db: Db,
    user: InvUser,
    cid: CompanyId,
    policy: InventoryPolicyDep,
    body: InventoryContractorCreateIn,
) -> InventoryContractorOut:
    dept = await _resolve_directory_department_slug(db, user, policy, cid, body.department_slug)
    now = datetime.now(timezone.utc)
    row = InventoryContractor(
        id=str(uuid4()),
        company_id=cid,
        department_slug=dept,
        name=body.name.strip(),
        contact_name=(body.contact_name or "").strip() or None,
        contact_email=(body.contact_email or "").strip() or None,
        contact_phone=(body.contact_phone or "").strip() or None,
        account_number=(body.account_number or "").strip() or None,
        payment_terms=(body.payment_terms or "").strip() or None,
        item_specialty=(body.item_specialty or "").strip() or None,
        notes=(body.notes or "").strip() or None,
        website=(body.website or "").strip() or None,
        address_line1=(body.address_line1 or "").strip() or None,
        address_line2=(body.address_line2 or "").strip() or None,
        city=(body.city or "").strip() or None,
        region=(body.region or "").strip() or None,
        postal_code=(body.postal_code or "").strip() or None,
        country=(body.country or "").strip() or None,
        is_active=bool(body.is_active),
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return InventoryContractorOut.model_validate(row)


@router.patch("/contractors/{contractor_id}", response_model=InventoryContractorOut)
async def patch_inventory_contractor(
    db: Db,
    user: InvUser,
    cid: CompanyId,
    policy: InventoryPolicyDep,
    contractor_id: str,
    body: InventoryContractorPatchIn,
) -> InventoryContractorOut:
    row = await db.get(InventoryContractor, contractor_id)
    if not row or row.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    if not policy.is_company_admin:
        allowed = await inventory_department_slugs_for_user(db, user, cid)
        if row.department_slug not in allowed:
            raise HTTPException(status_code=403, detail="Department access denied")
    data = body.model_dump(exclude_unset=True)
    if "department_slug" in data and data["department_slug"] is not None:
        row.department_slug = await _resolve_directory_department_slug(
            db, user, policy, cid, str(data.pop("department_slug"))
        )
    if "name" in data and data["name"] is not None:
        row.name = str(data["name"]).strip()
    str_fields = (
        "contact_name",
        "contact_email",
        "contact_phone",
        "account_number",
        "payment_terms",
        "item_specialty",
        "notes",
        "website",
        "address_line1",
        "address_line2",
        "city",
        "region",
        "postal_code",
        "country",
    )
    for k in str_fields:
        if k not in data:
            continue
        v = data[k]
        setattr(row, k, None if v is None else (str(v).strip() or None))
    if "is_active" in data and data["is_active"] is not None:
        row.is_active = bool(data["is_active"])
    row.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(row)
    return InventoryContractorOut.model_validate(row)


@router.delete("/contractors/{contractor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_inventory_contractor(
    db: Db,
    user: InvUser,
    cid: CompanyId,
    policy: InventoryPolicyDep,
    contractor_id: str,
) -> None:
    row = await db.get(InventoryContractor, contractor_id)
    if not row or row.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    if not policy.is_company_admin:
        allowed = await inventory_department_slugs_for_user(db, user, cid)
        if row.department_slug not in allowed:
            raise HTTPException(status_code=403, detail="Department access denied")
    await db.execute(delete(InventoryContractor).where(InventoryContractor.id == contractor_id))
    await db.commit()


async def _summary(
    db: AsyncSession,
    cid: str,
    policy: EffectiveInventoryPolicy,
    explicit_scope_id: Optional[str],
    conds: list,
) -> InventorySummaryOut:
    scope_pred = inv_scope_repo.scope_access_predicate(
        InventoryItem.scope_id,
        policy,
        explicit_scope_id=explicit_scope_id,
    )
    where_base = (
        and_(InventoryItem.company_id == cid, scope_pred, *conds)
        if conds
        else and_(InventoryItem.company_id == cid, scope_pred)
    )
    agg = (
        await db.execute(
            select(
                func.count().label("total"),
                func.count().filter(InventoryItem.inv_status == "in_stock").label("in_stock"),
                func.count().filter(InventoryItem.inv_status == "low_stock").label("low_stock"),
                func.count().filter(InventoryItem.inv_status == "assigned").label("assigned"),
                func.count().filter(InventoryItem.inv_status == "missing").label("missing"),
                func.count().filter(InventoryItem.inv_status == "maintenance").label("maintenance"),
                func.coalesce(
                    func.sum(InventoryItem.quantity * func.coalesce(InventoryItem.unit_cost, 0)),
                    0,
                ).label("estimated_value"),
            ).where(where_base)
        )
    ).one()
    total = int(agg.total or 0)
    in_stock = int(agg.in_stock or 0)
    low_stock = int(agg.low_stock or 0)
    assigned = int(agg.assigned or 0)
    missing = int(agg.missing or 0)
    maint = int(agg.maintenance or 0)
    ev = float(agg.estimated_value or 0)
    top_used_rows = (
        await db.execute(
            select(InventoryItem.id, InventoryItem.name, InventoryItem.sku, InventoryItem.usage_count)
            .where(and_(where_base, InventoryItem.usage_count > 0))
            .order_by(InventoryItem.usage_count.desc(), InventoryItem.name.asc())
            .limit(3)
        )
    ).all()
    most_used = [
        InventoryTopUsedOut(
            id=str(r.id),
            name=r.name,
            sku=r.sku or "",
            usage_count=int(r.usage_count or 0),
        )
        for r in top_used_rows
    ]
    replenishment = await compute_replenishment_analytics(db, cid)
    yoy = replenishment.yoy
    return InventorySummaryOut(
        total_items=total,
        in_stock=in_stock,
        low_stock=low_stock,
        assigned=assigned,
        missing=missing,
        maintenance=maint,
        estimated_value=round(ev, 2) if ev else None,
        most_used=most_used,
        replenishment_metrics=InventoryReplenishmentMetricsOut(
            active_queue_count=replenishment.active_queue_count,
            current_avg_time_in_queue_hours=replenishment.current_avg_time_in_queue_hours,
            current_max_time_in_queue_hours=replenishment.current_max_time_in_queue_hours,
            avg_time_in_queue_hours=replenishment.avg_time_in_queue_hours,
            avg_time_to_replenish_hours=replenishment.avg_time_to_replenish_hours,
            completed_cycles_count=replenishment.completed_cycles_count,
            yoy=InventoryReplenishmentYoyOut(
                current_year=yoy.current_year,
                prior_year=yoy.prior_year,
                avg_time_to_replenish_hours_current=yoy.avg_time_to_replenish_hours_current,
                avg_time_to_replenish_hours_prior=yoy.avg_time_to_replenish_hours_prior,
                completed_cycles_current_year=yoy.completed_cycles_current_year,
                completed_cycles_prior_year=yoy.completed_cycles_prior_year,
                change_pct=yoy.change_pct,
            ),
        ),
    )


@router.get("/scopes", response_model=list[InventoryScopeRowOut])
async def list_inventory_scopes(
    db: Db,
    _: InvUser,
    cid: CompanyId,
    policy: InventoryPolicyDep,
) -> list[InventoryScopeRowOut]:
    stmt = select(InventoryScope).where(InventoryScope.company_id == cid).order_by(InventoryScope.name.asc())
    if not policy.is_company_admin:
        if not policy.readable_scope_ids:
            return []
        stmt = stmt.where(InventoryScope.id.in_(list(policy.readable_scope_ids)))
    rows = list((await db.execute(stmt)).scalars().all())
    return [
        InventoryScopeRowOut(
            id=r.id,
            name=r.name,
            slug=r.slug,
            is_shared=bool(r.is_shared),
            description=r.description,
        )
        for r in rows
    ]


@router.get("", response_model=InventoryListOut)
async def list_inventory(
    db: Db,
    _: InvUser,
    cid: CompanyId,
    policy: InventoryPolicyDep,
    q: Optional[str] = Query(None),
    inv_status: Optional[str] = Query(None, alias="status"),
    item_type: Optional[str] = Query(None),
    category: Optional[str] = None,
    zone_id: Optional[str] = None,
    assigned_user_id: Optional[str] = None,
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    department_slug: Optional[str] = Query(None, description="Filter by workspace department slug"),
    scope_id: Optional[str] = Query(None, description="Optional narrow filter by inventory scope id"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> InventoryListOut:
    explicit_scope_id = await _validated_explicit_scope_id(db, cid, policy, scope_id)

    conds: list = []
    if q and q.strip():
        like = f"%{q.strip()}%"
        conds.append(or_(InventoryItem.name.ilike(like), InventoryItem.sku.ilike(like), InventoryItem.category.ilike(like)))
    if inv_status:
        conds.append(InventoryItem.inv_status == inv_status)
    if item_type:
        conds.append(InventoryItem.item_type == item_type)
    if category:
        conds.append(InventoryItem.category == category)
    if zone_id:
        conds.append(InventoryItem.zone_id == zone_id)
    if assigned_user_id:
        conds.append(InventoryItem.assigned_user_id == assigned_user_id)
    if department_slug and department_slug.strip():
        ds = await _normalize_department_slug(db, cid, department_slug)
        sq = await db.execute(
            select(InventoryScope.id).where(InventoryScope.company_id == cid, InventoryScope.slug == ds)
        )
        dept_scope_ids = [str(r[0]) for r in sq.all()]
        if dept_scope_ids:
            conds.append(InventoryItem.scope_id.in_(dept_scope_ids))
        else:
            conds.append(InventoryItem.department_slug == ds)
    if date_from:
        conds.append(InventoryItem.last_movement_at.isnot(None))
        conds.append(InventoryItem.last_movement_at >= date_from)
    if date_to:
        conds.append(InventoryItem.last_movement_at.isnot(None))
        conds.append(InventoryItem.last_movement_at <= date_to)

    scope_pred = inv_scope_repo.scope_access_predicate(
        InventoryItem.scope_id,
        policy,
        explicit_scope_id=explicit_scope_id,
    )
    where_clause = (
        and_(InventoryItem.company_id == cid, scope_pred, *conds)
        if conds
        else and_(InventoryItem.company_id == cid, scope_pred)
    )

    total = int(
        (await db.execute(select(func.count()).select_from(InventoryItem).where(where_clause))).scalar_one() or 0
    )
    summ = await _summary(db, cid, policy, explicit_scope_id, conds)

    stmt = (
        select(InventoryItem)
        .where(where_clause)
        .order_by(InventoryItem.name.asc())
        .offset(offset)
        .limit(limit)
    )
    rows = list((await db.execute(stmt)).scalars().all())
    user_ids, zone_ids, tool_ids = collect_item_reference_ids(rows)
    users, zones, tools = await ctx_maps_for_ids(
        db, cid, user_ids=user_ids, zone_ids=zone_ids, tool_ids=tool_ids
    )
    last_used = await last_used_at_map(db, [str(r.id) for r in rows])
    mr_ids = await inventory_item_ids_mr_on_order(db, cid)
    items = [
        _row(
            it,
            users=users,
            zones=zones,
            tools=tools,
            last_used=last_used.get(str(it.id)),
            mr_on_order=str(it.id) in mr_ids,
        )
        for it in rows
    ]

    return InventoryListOut(items=items, total=total, summary=summ)


async def _lookup_item_by_sku(
    db: AsyncSession,
    cid: str,
    policy: EffectiveInventoryPolicy,
    sku: str,
) -> InventoryItem:
    normalized = sku.strip()
    if not normalized:
        raise HTTPException(status_code=400, detail="SKU is required")
    stmt = select(InventoryItem).where(
        InventoryItem.company_id == cid,
        func.lower(InventoryItem.sku) == normalized.lower(),
    )
    if not policy.is_company_admin and policy.readable_scope_ids:
        stmt = stmt.where(InventoryItem.scope_id.in_(list(policy.readable_scope_ids)))
    item = (await db.execute(stmt)).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="No inventory item for this SKU")
    if not inv_scope_repo.can_read_inventory_item(policy, item):
        raise HTTPException(status_code=404, detail="No inventory item for this SKU")
    return item


def _scan_lookup_out(
    item: InventoryItem,
    *,
    users: dict[str, User],
    zones: dict[str, Zone],
    tools: dict[str, Tool],
) -> InventoryScanLookupOut:
    z = zones.get(item.zone_id) if item.zone_id else None
    t = tools.get(item.linked_tool_id) if item.linked_tool_id else None
    return InventoryScanLookupOut(
        id=item.id,
        sku=item.sku,
        name=item.name,
        item_type=item.item_type,
        category=item.category,
        inv_status=item.inv_status,
        quantity=item.quantity,
        unit=item.unit,
        low_stock_threshold=item.low_stock_threshold,
        location_name=z.name if z else None,
        zone_id=str(item.zone_id) if item.zone_id else None,
        image_url=item.image_url or (t.image_url if t else None),
        department_slug=item.department_slug or "maintenance",
    )


@router.get("/scan/by-sku/{sku}", response_model=InventoryScanLookupOut)
async def lookup_inventory_by_sku(
    db: Db,
    _: InvScanUser,
    cid: CompanyId,
    policy: InventoryPolicyDep,
    sku: str,
) -> InventoryScanLookupOut:
    item = await _lookup_item_by_sku(db, cid, policy, sku)
    user_ids, zone_ids, tool_ids = collect_item_reference_ids([item])
    users, zones, tools = await ctx_maps_for_ids(
        db, cid, user_ids=user_ids, zone_ids=zone_ids, tool_ids=tool_ids
    )
    return _scan_lookup_out(item, users=users, zones=zones, tools=tools)


@router.get("/scan/transaction-settings", response_model=InventoryTransactionSettingsOut)
async def get_inventory_transaction_settings(
    db: Db,
    _: InvScanUser,
    cid: CompanyId,
) -> InventoryTransactionSettingsOut:
    row = await _get_settings_row(db, cid)
    merged = merge_inventory_settings(row.settings if row else None)
    return transaction_settings_to_out(transaction_settings_from_inventory_module(merged))


@router.post("/scan/transaction", response_model=InventoryScanTransactionOut)
async def post_inventory_scan_transaction(
    db: Db,
    user: InvManageUser,
    cid: CompanyId,
    policy: InventoryPolicyDep,
    body: InventoryScanTransactionIn,
) -> InventoryScanTransactionOut:
    item = await _lookup_item_by_sku(db, cid, policy, body.sku)
    row = await _get_settings_row(db, cid)
    merged = merge_inventory_settings(row.settings if row else None)
    cfg = transaction_settings_from_inventory_module(merged)
    ref = None
    if cfg.enable_references:
        ref = InventoryTransactionReferenceIn(
            reference_type=body.reference_type,
            reference_id=body.reference_id,
            reference_note=body.reference_note or body.notes,
        )
    try:
        _validate_references(
            cfg,
            batch_ref=ref,
            lines=[
                InventoryTransactionLineIn(
                    item_id=item.id,
                    quantity=body.quantity,
                    location_id=body.location_id,
                    reference=ref,
                )
            ],
        )
        line_out = await apply_transaction_line(
            db,
            company_id=cid,
            user=user,
            policy=policy,
            item=item,
            transaction_type=body.action,
            quantity=body.quantity,
            location_id=body.location_id if cfg.enable_location_selection else None,
            reference=ref,
            legacy_notes=body.notes if not cfg.enable_references else None,
            channel="inventory_scanner_kiosk",
        )
    except PermissionError:
        raise HTTPException(status_code=403, detail="Inventory write denied") from None
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    await db.commit()
    await db.refresh(item)
    user_ids, zone_ids, tool_ids = collect_item_reference_ids([item])
    users, zones, tools = await ctx_maps_for_ids(
        db, cid, user_ids=user_ids, zone_ids=zone_ids, tool_ids=tool_ids
    )
    delta = line_out.quantity_after - line_out.quantity_before
    return InventoryScanTransactionOut(
        item=_scan_lookup_out(item, users=users, zones=zones, tools=tools),
        action=body.action,
        quantity_delta=delta,
        quantity_before=line_out.quantity_before,
        quantity_after=line_out.quantity_after,
        movement_id=line_out.movement_id,
        created_at=datetime.now(timezone.utc),
    )


@router.post("/scan/transactions", response_model=InventoryBatchTransactionOut)
async def post_inventory_batch_transaction(
    db: Db,
    user: InvManageUser,
    cid: CompanyId,
    policy: InventoryPolicyDep,
    body: InventoryBatchTransactionIn,
) -> InventoryBatchTransactionOut:
    row = await _get_settings_row(db, cid)
    merged = merge_inventory_settings(row.settings if row else None)
    try:
        out = await commit_batch_transaction(
            db,
            company_id=cid,
            user=user,
            policy=policy,
            body=body,
            module_settings=merged,
            channel="inventory_transactions",
        )
    except PermissionError:
        raise HTTPException(status_code=403, detail="Inventory write denied") from None
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    await db.commit()
    return out


@router.get("/{item_id}", response_model=InventoryDetailOut)
async def get_inventory_item(
    db: Db,
    user: InvUser,
    cid: CompanyId,
    policy: InventoryPolicyDep,
    item_id: str,
) -> InventoryDetailOut:
    item = await db.get(InventoryItem, item_id)
    if not item:
        _log.info(
            "Inventory item lookup missed",
            extra={
                "tenant_id": cid,
                "user_id": str(user.id),
                "item_id": item_id,
                "reason": "not_found",
            },
        )
        raise HTTPException(status_code=404, detail="Not found")
    if item.company_id != cid:
        _log.info(
            "Inventory item lookup denied",
            extra={
                "tenant_id": cid,
                "user_id": str(user.id),
                "item_id": item_id,
                "item_company_id": str(item.company_id),
                "reason": "wrong_tenant",
            },
        )
        raise HTTPException(status_code=404, detail="Not found")
    if not inv_scope_repo.can_read_inventory_item(policy, item):
        _log.info(
            "Inventory item lookup denied",
            extra={
                "tenant_id": cid,
                "user_id": str(user.id),
                "item_id": item_id,
                "item_scope_id": str(item.scope_id),
                "reason": "scope_denied",
            },
        )
        raise HTTPException(status_code=404, detail="Not found")
    return await _inventory_detail_payload(db, cid, item)


@router.post("", response_model=InventoryDetailOut, status_code=status.HTTP_201_CREATED)
async def create_inventory_item(
    db: Db,
    user: InvManageUser,
    cid: CompanyId,
    policy: InventoryPolicyDep,
    body: InventoryCreateIn,
) -> InventoryDetailOut:
    sku = (body.sku or "").strip() or f"INV-{uuid4().hex[:8].upper()}"
    location_lines: list[tuple[str, float]] = []
    if body.location_lines:
        location_lines = await _normalize_location_lines(
            db,
            cid,
            [(ln.zone_id, ln.quantity) for ln in body.location_lines],
        )
    elif body.zone_id:
        await _assert_inventory_storage_zone(db, cid, body.zone_id)
        if float(body.quantity) > 0:
            location_lines = [(body.zone_id, float(body.quantity))]
    if body.assigned_user_id and not await pulse_svc._user_in_company(db, cid, body.assigned_user_id):
        raise HTTPException(status_code=400, detail="Unknown assignee")
    if body.linked_tool_id and not await pulse_svc.tool_in_company(db, cid, body.linked_tool_id):
        raise HTTPException(status_code=400, detail="Unknown linked asset")

    if body.scope_id and str(body.scope_id).strip():
        scope_row = await inv_scope_repo.get_inventory_scope(db, str(body.scope_id).strip(), cid)
        if scope_row is None:
            raise HTTPException(status_code=400, detail="Unknown inventory scope")
    else:
        dept_slug = await _resolve_directory_department_slug(db, user, policy, cid, body.department_slug)
        scope_row = await inv_scope_repo.ensure_scope_for_company_slug(db, cid, dept_slug)

    if not policy.is_company_admin and scope_row.id not in policy.writable_scope_ids:
        raise HTTPException(status_code=403, detail="Inventory write denied")

    exists = await db.execute(
        select(InventoryItem.id).where(InventoryItem.company_id == cid, InventoryItem.sku == sku)
    )
    if exists.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="SKU already exists")

    inv_st = body.inv_status
    slug_disp = scope_row.slug[:64]
    create_qty = sum(q for _, q in location_lines) if location_lines else float(body.quantity)
    create_zone = location_lines[0][0] if location_lines else body.zone_id
    item = InventoryItem(
        id=str(uuid4()),
        company_id=cid,
        scope_id=scope_row.id,
        sku=sku,
        name=body.name.strip(),
        quantity=create_qty,
        unit=body.unit,
        low_stock_threshold=float(body.low_stock_threshold),
        maximum_qty=float(body.maximum_qty) if body.maximum_qty is not None else None,
        item_type=body.item_type,
        category=body.category,
        inv_status=inv_st or "in_stock",
        zone_id=create_zone,
        assigned_user_id=body.assigned_user_id,
        linked_tool_id=body.linked_tool_id,
        item_condition=body.condition,
        department_slug=slug_disp,
        reorder_flag=body.reorder_flag,
        unit_cost=body.unit_cost,
        vendor=(body.vendor or "").strip() or None,
        custom_attributes=dict(body.custom_attributes or {}),
    )
    _apply_location_stock(item, location_lines)
    if body.assigned_user_id:
        item.inv_status = "assigned"
    elif not inv_st:
        _recompute_status(item)
    now = datetime.now(timezone.utc)
    item.last_movement_at = now
    db.add(item)
    await db.flush()
    await _log_movement(
        db,
        company_id=cid,
        item_id=item.id,
        action="created",
        performed_by=user.id,
        zone_id=item.zone_id,
        meta={"name": item.name},
    )
    await _sync_stock_queue_and_alerts(db, item)
    await db.commit()
    await db.refresh(item)
    return await _inventory_detail_payload(db, cid, item)


@router.patch("/{item_id}", response_model=InventoryDetailOut)
async def patch_inventory_item(
    db: Db,
    user: InvManageUser,
    cid: CompanyId,
    policy: InventoryPolicyDep,
    item_id: str,
    body: InventoryPatchIn,
) -> InventoryDetailOut:
    item = await db.get(InventoryItem, item_id)
    if not item or item.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    if not inv_scope_repo.can_read_inventory_item(policy, item):
        raise HTTPException(status_code=404, detail="Not found")
    if not inv_scope_repo.can_write_inventory_item(policy, item):
        raise HTTPException(status_code=403, detail="Inventory write denied")

    data = body.model_dump(exclude_unset=True)
    location_lines_raw = data.pop("location_lines", None)
    if "zone_id" in data and data["zone_id"]:
        await _assert_inventory_storage_zone(db, cid, str(data["zone_id"]))
    if "assigned_user_id" in data and data["assigned_user_id"]:
        if not await pulse_svc._user_in_company(db, cid, data["assigned_user_id"]):
            raise HTTPException(status_code=400, detail="Unknown assignee")
    if "linked_tool_id" in data and data["linked_tool_id"]:
        if not await pulse_svc.tool_in_company(db, cid, data["linked_tool_id"]):
            raise HTTPException(status_code=400, detail="Unknown linked asset")

    new_scope_raw = data.pop("scope_id", None)

    cond = data.pop("condition", None)
    if cond is not None:
        item.item_condition = cond
    ds = data.pop("department_slug", None)
    if ds is not None:
        slug_norm = await _normalize_department_slug(db, cid, str(ds))
        dest = await inv_scope_repo.ensure_scope_for_company_slug(db, cid, slug_norm)
        if not inv_scope_repo.can_transfer_inventory_item_to_scope(
            policy, source_item=item, destination_scope_id=dest.id
        ):
            raise HTTPException(status_code=403, detail="Inventory write denied")
        item.scope_id = dest.id
        item.department_slug = dest.slug[:64]

    if new_scope_raw is not None:
        dest = await inv_scope_repo.get_inventory_scope(db, str(new_scope_raw).strip(), cid)
        if dest is None:
            raise HTTPException(status_code=400, detail="Unknown inventory scope")
        if not inv_scope_repo.can_transfer_inventory_item_to_scope(
            policy, source_item=item, destination_scope_id=dest.id
        ):
            raise HTTPException(status_code=403, detail="Inventory write denied")
        item.scope_id = dest.id
        item.department_slug = dest.slug[:64]

    for k in (
        "name",
        "item_type",
        "category",
        "quantity",
        "unit",
        "low_stock_threshold",
        "inv_status",
        "zone_id",
        "assigned_user_id",
        "linked_tool_id",
        "unit_cost",
        "reorder_flag",
    ):
        if k in data and data[k] is not None:
            setattr(item, k, data[k])
    if "vendor" in data:
        vraw = data["vendor"]
        item.vendor = None if vraw is None else (str(vraw).strip() or None)
    custom_attrs_patch = data.pop("custom_attributes", None)
    if custom_attrs_patch is not None:
        merged_attrs = dict(item.custom_attributes or {})
        merged_attrs.update(custom_attrs_patch)
        item.custom_attributes = merged_attrs
    if location_lines_raw is not None:
        location_lines = await _normalize_location_lines(
            db,
            cid,
            [(str(ln["zone_id"]), float(ln["quantity"])) for ln in location_lines_raw],
        )
        _apply_location_stock(
            item,
            location_lines,
            custom_attributes=item.custom_attributes,
        )
        data.pop("quantity", None)
        data.pop("zone_id", None)
    elif ("zone_id" in data or "quantity" in data) and _parse_location_stock(item.custom_attributes):
        attrs = dict(item.custom_attributes or {})
        attrs.pop(LOCATION_STOCK_KEY, None)
        item.custom_attributes = attrs
    if "maximum_qty" in data:
        raw_max = data["maximum_qty"]
        item.maximum_qty = None if raw_max is None else float(raw_max)
    if "inv_status" not in data:
        _recompute_status(item)
    item.last_movement_at = datetime.now(timezone.utc)
    await _sync_stock_queue_and_alerts(db, item)
    await _log_movement(
        db,
        company_id=cid,
        item_id=item.id,
        action="updated",
        performed_by=user.id,
        meta={"fields": list(body.model_dump(exclude_unset=True).keys())},
    )
    await db.commit()
    await db.refresh(item)
    return await _inventory_detail_payload(db, cid, item)


@router.get("/{item_id}/image")
async def get_inventory_item_image(
    db: Db,
    _: InvUser,
    cid: CompanyId,
    policy: InventoryPolicyDep,
    item_id: str,
) -> Response:
    item = await _get_inventory_item_for_company(db, cid, policy, item_id)
    try:
        blob = await read_inventory_item_image_bytes(
            cid, item_id, storage_key=getattr(item, "image_storage_key", None)
        )
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)) from e
    if not blob:
        # Self-heal stale image_url pointers (e.g. ephemeral disk on Render after redeploy).
        if item.image_url or getattr(item, "image_storage_key", None):
            item.image_url = None
            item.image_storage_key = None
            await db.commit()
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    data, media_type = blob
    return Response(content=data, media_type=media_type, headers={"Cache-Control": "private, no-store"})


@router.post("/{item_id}/image", response_model=InventoryImageUploadOut)
async def upload_inventory_item_image(
    db: Db,
    _: InvManageUser,
    cid: CompanyId,
    policy: InventoryPolicyDep,
    item_id: str,
    file: UploadFile = File(...),
) -> InventoryImageUploadOut:
    item = await _get_inventory_item_for_company(db, cid, policy, item_id, write=True)
    stored = await _save_inventory_item_image_upload(file, cid, item_id)
    internal = _inventory_image_internal_url(item_id)
    item.image_storage_key = stored.object_key
    item.image_url = stored_object_display_url(stored, internal)
    await db.commit()
    await db.refresh(item)
    return InventoryImageUploadOut(image_url=item.image_url or internal)


@router.post("/{item_id}/assign", response_model=InventoryDetailOut)
async def assign_inventory(
    db: Db,
    user: InvManageUser,
    cid: CompanyId,
    policy: InventoryPolicyDep,
    item_id: str,
    body: InventoryAssignIn,
) -> InventoryDetailOut:
    item = await db.get(InventoryItem, item_id)
    if not item or item.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    if not inv_scope_repo.can_read_inventory_item(policy, item):
        raise HTTPException(status_code=404, detail="Not found")
    if not inv_scope_repo.can_write_inventory_item(policy, item):
        raise HTTPException(status_code=403, detail="Inventory write denied")
    uid = body.user_id
    if uid and not await pulse_svc._user_in_company(db, cid, uid):
        raise HTTPException(status_code=400, detail="Unknown assignee")
    item.assigned_user_id = uid
    if uid:
        item.inv_status = "assigned"
    else:
        _recompute_status(item)
    item.last_movement_at = datetime.now(timezone.utc)
    await _log_movement(
        db,
        company_id=cid,
        item_id=item.id,
        action="assigned" if uid else "returned",
        performed_by=user.id,
        quantity=1.0 if item.item_type == "tool" else item.quantity,
        meta={"user_id": uid},
    )
    await db.commit()
    await db.refresh(item)
    return await _inventory_detail_payload(db, cid, item)


@router.post("/{item_id}/move", response_model=InventoryDetailOut)
async def move_inventory(
    db: Db,
    user: InvManageUser,
    cid: CompanyId,
    policy: InventoryPolicyDep,
    item_id: str,
    body: InventoryMoveIn,
) -> InventoryDetailOut:
    item = await db.get(InventoryItem, item_id)
    if not item or item.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    if not inv_scope_repo.can_read_inventory_item(policy, item):
        raise HTTPException(status_code=404, detail="Not found")
    if not inv_scope_repo.can_write_inventory_item(policy, item):
        raise HTTPException(status_code=403, detail="Inventory write denied")
    zid = body.zone_id
    if zid:
        await _assert_inventory_storage_zone(db, cid, zid)
    attrs = dict(item.custom_attributes or {})
    attrs.pop(LOCATION_STOCK_KEY, None)
    item.custom_attributes = attrs
    item.zone_id = zid
    item.last_movement_at = datetime.now(timezone.utc)
    await _log_movement(
        db,
        company_id=cid,
        item_id=item.id,
        action="moved",
        performed_by=user.id,
        zone_id=zid,
        meta={},
    )
    await db.commit()
    await db.refresh(item)
    return await _inventory_detail_payload(db, cid, item)


@router.post("/{item_id}/use", response_model=InventoryDetailOut)
async def use_inventory(
    db: Db,
    user: InvManageUser,
    cid: CompanyId,
    policy: InventoryPolicyDep,
    item_id: str,
    body: InventoryUseIn,
) -> InventoryDetailOut:
    item = await db.get(InventoryItem, item_id)
    if not item or item.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    if not inv_scope_repo.can_read_inventory_item(policy, item):
        raise HTTPException(status_code=404, detail="Not found")
    if not inv_scope_repo.can_write_inventory_item(policy, item):
        raise HTTPException(status_code=403, detail="Inventory write denied")
    wr = await db.get(PulseWorkRequest, body.work_request_id)
    if not wr or wr.company_id != cid:
        raise HTTPException(status_code=400, detail="Unknown work request")
    qty = float(body.quantity)
    if item.item_type in ("part", "consumable"):
        if item.quantity < qty:
            raise HTTPException(status_code=400, detail="Insufficient quantity")
        item.quantity -= qty
        item.usage_count += int(qty) if item.unit == "count" else int(qty)
    else:
        item.usage_count += 1

    db.add(
        InventoryUsage(
            id=str(uuid4()),
            company_id=cid,
            item_id=item.id,
            work_request_id=wr.id,
            quantity=qty,
        )
    )
    item.last_movement_at = datetime.now(timezone.utc)
    _recompute_status(item)
    await _sync_stock_queue_and_alerts(db, item)
    await _log_movement(
        db,
        company_id=cid,
        item_id=item.id,
        action="used",
        performed_by=user.id,
        quantity=qty,
        work_request_id=wr.id,
        meta={"work_request_title": wr.title},
    )
    await db.commit()
    await db.refresh(item)
    return await _inventory_detail_payload(db, cid, item)


from app.api.inventory_enterprise_routes import router as inventory_enterprise_router

router.include_router(inventory_enterprise_router)
