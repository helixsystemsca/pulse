"""Purchasing: quick purchases, receipts, history, vendor performance, exports."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_db, require_any_rbac
from app.api.inventory_portal_routes import (
    CompanyId,
    InventoryPolicyDep,
    _get_settings_row,
    merge_inventory_settings,
)
from app.core.purchasing_module_config import merge_purchasing_settings
from app.core.pulse_storage import read_purchase_receipt_bytes, write_purchase_receipt_bytes
from app.models.domain import (
    InventoryVendor,
    PurchasingQuickPurchase,
    PurchasingQuickPurchaseLine,
    User,
)
from app.schemas.purchasing import (
    InventoryVendorWithPerformanceOut,
    PurchasingSettingsOut,
    QuickPurchaseCreateIn,
    QuickPurchaseListOut,
    QuickPurchaseOut,
    QuickPurchaseLineOut,
)
from app.services import purchasing_export_service as export_svc
from app.services import purchasing_service as purch_svc

router = APIRouter(prefix="/purchasing", tags=["purchasing"])

Db = Annotated[AsyncSession, Depends(get_db)]
PurchUser = Annotated[User, Depends(require_any_rbac("inventory.view", "inventory.manage"))]
PurchManageUser = Annotated[User, Depends(require_any_rbac("inventory.manage"))]

_RECEIPT_EXTS = {".pdf", ".jpg", ".jpeg", ".png", ".webp", ".heic"}


def _ext_from_filename(name: str) -> str:
    lower = (name or "").lower()
    for ext in _RECEIPT_EXTS:
        if lower.endswith(ext):
            return ext
    return ".jpg"


async def _module_settings(db: AsyncSession, company_id: str) -> dict:
    row = await _get_settings_row(db, company_id)
    return merge_inventory_settings(row.settings if row else None)


def _purchase_out(p: PurchasingQuickPurchase, user_name: Optional[str] = None) -> QuickPurchaseOut:
    lines = sorted(p.lines, key=lambda x: x.sort_order) if p.lines else []
    return QuickPurchaseOut(
        id=p.id,
        company_id=p.company_id,
        purchase_date=p.purchase_date,
        vendor_id=p.vendor_id,
        vendor_name=p.vendor_name,
        total_amount=p.total_amount,
        notes=p.notes,
        add_to_inventory=p.add_to_inventory,
        has_receipt=bool(p.receipt_filename),
        receipt_filename=p.receipt_filename,
        created_by_user_id=p.created_by_user_id,
        created_by_name=user_name,
        created_at=p.created_at,
        lines=[
            QuickPurchaseLineOut(
                id=ln.id,
                name=ln.name,
                quantity=ln.quantity,
                unit_cost=ln.unit_cost,
                category=ln.category,
                add_to_inventory=ln.add_to_inventory,
                zone_id=ln.zone_id,
                inventory_item_id=ln.inventory_item_id,
            )
            for ln in lines
        ],
    )


@router.get("/settings", response_model=PurchasingSettingsOut)
async def get_purchasing_settings(
    db: Db,
    _: PurchUser,
    cid: CompanyId,
) -> PurchasingSettingsOut:
    merged = await _module_settings(db, cid)
    return PurchasingSettingsOut(**merge_purchasing_settings(merged.get("purchasing")))


@router.get("/quick-purchases", response_model=QuickPurchaseListOut)
async def list_quick_purchases(
    db: Db,
    _: PurchUser,
    cid: CompanyId,
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    vendor_id: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> QuickPurchaseListOut:
    conds = [PurchasingQuickPurchase.company_id == cid]
    if date_from:
        conds.append(PurchasingQuickPurchase.purchase_date >= date_from)
    if date_to:
        conds.append(PurchasingQuickPurchase.purchase_date <= date_to)
    if vendor_id:
        conds.append(PurchasingQuickPurchase.vendor_id == vendor_id)

    count_q = select(func.count()).select_from(PurchasingQuickPurchase).where(*conds)
    total = int((await db.execute(count_q)).scalar_one() or 0)

    q = (
        select(PurchasingQuickPurchase)
        .where(*conds)
        .options(selectinload(PurchasingQuickPurchase.lines))
        .order_by(PurchasingQuickPurchase.purchase_date.desc(), PurchasingQuickPurchase.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = (await db.execute(q)).scalars().unique().all()

    if category:
        cat = category.strip().lower()
        filtered = []
        for p in rows:
            if any((ln.category or "").lower() == cat for ln in p.lines):
                filtered.append(p)
        rows = filtered

    user_ids = {p.created_by_user_id for p in rows if p.created_by_user_id}
    names: dict[str, str] = {}
    if user_ids:
        urows = (await db.execute(select(User).where(User.id.in_(user_ids)))).scalars().all()
        for u in urows:
            names[u.id] = u.full_name or u.email

    return QuickPurchaseListOut(
        items=[_purchase_out(p, names.get(p.created_by_user_id or "")) for p in rows],
        total=total,
    )


@router.post("/quick-purchases", response_model=QuickPurchaseOut, status_code=status.HTTP_201_CREATED)
async def create_quick_purchase(
    db: Db,
    user: PurchManageUser,
    cid: CompanyId,
    policy: InventoryPolicyDep,
    body: QuickPurchaseCreateIn,
) -> QuickPurchaseOut:
    merged = await _module_settings(db, cid)
    cfg = merge_purchasing_settings(merged.get("purchasing"))
    if not cfg.get("enable_quick_purchases", True):
        raise HTTPException(status_code=400, detail="Quick purchases are disabled for this organization")
    if cfg.get("require_receipt_upload"):
        raise HTTPException(
            status_code=400,
            detail="Receipt is required — create the purchase then upload the receipt",
        )

    try:
        purchase = await purch_svc.create_quick_purchase(
            db, company_id=cid, user=user, policy=policy, body=body, module_settings=merged
        )
    except PermissionError:
        raise HTTPException(status_code=403, detail="Inventory write denied") from None
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    await db.commit()
    row = (
        await db.execute(
            select(PurchasingQuickPurchase)
            .where(PurchasingQuickPurchase.id == purchase.id)
            .options(selectinload(PurchasingQuickPurchase.lines))
        )
    ).scalar_one()
    return _purchase_out(row, user.full_name or user.email)


@router.get("/quick-purchases/{purchase_id}", response_model=QuickPurchaseOut)
async def get_quick_purchase(
    db: Db,
    _: PurchUser,
    cid: CompanyId,
    purchase_id: str,
) -> QuickPurchaseOut:
    row = (
        await db.execute(
            select(PurchasingQuickPurchase)
            .where(
                PurchasingQuickPurchase.id == purchase_id,
                PurchasingQuickPurchase.company_id == cid,
            )
            .options(selectinload(PurchasingQuickPurchase.lines))
        )
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    uname = None
    if row.created_by_user_id:
        u = await db.get(User, row.created_by_user_id)
        uname = u.full_name or u.email if u else None
    return _purchase_out(row, uname)


@router.post("/quick-purchases/{purchase_id}/receipt")
async def upload_purchase_receipt(
    db: Db,
    _: PurchManageUser,
    cid: CompanyId,
    purchase_id: str,
    file: UploadFile = File(...),
) -> dict:
    merged = await _module_settings(db, cid)
    cfg = merge_purchasing_settings(merged.get("purchasing"))
    if not cfg.get("enable_receipt_uploads", True):
        raise HTTPException(status_code=400, detail="Receipt uploads are disabled")

    row = await db.get(PurchasingQuickPurchase, purchase_id)
    if not row or row.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")

    raw = await file.read()
    if not raw or len(raw) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Invalid or oversized file (max 10MB)")

    ext = _ext_from_filename(file.filename or "")
    ct = (file.content_type or "").split(";")[0].strip() or "application/octet-stream"
    try:
        await write_purchase_receipt_bytes(cid, purchase_id, ext, raw, ct)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e

    row.receipt_filename = file.filename or f"receipt{ext}"
    row.receipt_content_type = ct
    row.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True, "filename": row.receipt_filename}


@router.get("/quick-purchases/{purchase_id}/receipt")
async def download_purchase_receipt(
    db: Db,
    _: PurchUser,
    cid: CompanyId,
    purchase_id: str,
) -> Response:
    row = await db.get(PurchasingQuickPurchase, purchase_id)
    if not row or row.company_id != cid:
        raise HTTPException(status_code=404, detail="Not found")
    try:
        blob = await read_purchase_receipt_bytes(cid, purchase_id)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    if not blob:
        raise HTTPException(status_code=404, detail="No receipt on file")
    data, media_type = blob
    filename = row.receipt_filename or "receipt"
    return Response(
        content=data,
        media_type=media_type,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.get("/vendors", response_model=list[InventoryVendorWithPerformanceOut])
async def list_vendors_with_performance(
    db: Db,
    _: PurchUser,
    cid: CompanyId,
) -> list[InventoryVendorWithPerformanceOut]:
    merged = await _module_settings(db, cid)
    cfg = merge_purchasing_settings(merged.get("purchasing"))
    if not cfg.get("enable_vendor_tracking", True):
        return []

    vendors = (
        await db.execute(
            select(InventoryVendor)
            .where(InventoryVendor.company_id == cid, InventoryVendor.is_active.is_(True))
            .order_by(InventoryVendor.name.asc())
        )
    ).scalars().all()
    stats = await purch_svc.vendor_purchase_stats(db, cid, [v.id for v in vendors])
    out: list[InventoryVendorWithPerformanceOut] = []
    for v in vendors:
        s = stats.get(v.id, {})
        out.append(
            InventoryVendorWithPerformanceOut(
                id=v.id,
                name=v.name,
                contact_name=v.contact_name,
                contact_email=v.contact_email,
                contact_phone=v.contact_phone,
                website=v.website,
                notes=v.notes,
                is_active=v.is_active,
                preferred_vendor=bool(getattr(v, "preferred_vendor", False)),
                total_purchases=s.get("total_purchases", 0),
                last_purchase_date=s.get("last_purchase_date"),
                average_purchase_value=s.get("average_purchase_value"),
            )
        )
    return out


@router.get("/export/expenses")
async def export_monthly_expenses(
    db: Db,
    _: PurchUser,
    cid: CompanyId,
    month: Optional[str] = Query(None, description="YYYY-MM"),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
) -> Response:
    merged = await _module_settings(db, cid)
    cfg = merge_purchasing_settings(merged.get("purchasing"))
    if not cfg.get("enable_monthly_expense_exports", True):
        raise HTTPException(status_code=400, detail="Monthly expense exports are disabled")

    df = date_from
    dt = date_to
    label = "custom-range"
    if month:
        try:
            y, m = month.split("-", 1)
            y_i, m_i = int(y), int(m)
            df = date(y_i, m_i, 1)
            if m_i == 12:
                dt = date(y_i + 1, 1, 1)
            else:
                dt = date(y_i, m_i + 1, 1)
            dt = dt - timedelta(days=1)
            label = month
        except (ValueError, TypeError) as e:
            raise HTTPException(status_code=400, detail="month must be YYYY-MM") from e

    if not df or not dt:
        raise HTTPException(status_code=400, detail="Provide month=YYYY-MM or date_from and date_to")

    rows = (
        await db.execute(
            select(PurchasingQuickPurchase)
            .where(
                PurchasingQuickPurchase.company_id == cid,
                PurchasingQuickPurchase.purchase_date >= df,
                PurchasingQuickPurchase.purchase_date <= dt,
            )
            .order_by(PurchasingQuickPurchase.purchase_date.asc())
        )
    ).scalars().all()

    data, filename = export_svc.build_expense_workbook(rows, period_label=label)
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
