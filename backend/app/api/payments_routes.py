"""
Payments / billing API under `/api/payments`.

Mock storage only (last4, labels). `company_admin` or `system_admin` (with `company_id` query).
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Annotated, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_company_admin
from app.models.domain import (
    Invoice,
    InvoiceStatus,
    PaymentMethod,
    PaymentMethodKind,
    PaymentRail,
    User,
    UserRole,
)
from app.schemas.payments import (
    InvoiceListOut,
    InvoiceOut,
    PaymentMethodCreate,
    PaymentMethodOut,
    PaymentSummaryOut,
)

router = APIRouter(prefix="/payments", tags=["payments"])


async def resolve_payments_company_id(
    user: Annotated[User, Depends(get_current_user)],
    company_id: Optional[str] = Query(None, description="Required for system administrators"),
) -> str:
    if user.role == UserRole.system_admin or user.is_system_admin:
        if not company_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="company_id is required for system administrators",
            )
        return company_id
    if user.company_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a tenant user")
    cid = str(user.company_id)
    if company_id is not None and company_id != cid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Company access denied")
    return cid


CompanyId = Annotated[str, Depends(resolve_payments_company_id)]
Db = Annotated[AsyncSession, Depends(get_db)]
AdminUser = Annotated[User, Depends(require_company_admin)]


def _brand_from_pan(digits: str) -> str:
    if digits.startswith("4"):
        return "visa"
    if digits and digits[0] == "5":
        return "mastercard"
    if len(digits) >= 2 and digits[:2] in ("34", "37"):
        return "amex"
    return "other"


def _parse_expiry(expiry: str) -> tuple[int, int]:
    m = re.match(r"^\s*(\d{1,2})\s*/\s*(\d{2,4})\s*$", expiry.strip())
    if not m:
        raise HTTPException(status_code=400, detail="expiry must be MM/YY")
    month = int(m.group(1))
    y = m.group(2)
    year = int(y) if len(y) == 4 else 2000 + int(y)
    if not 1 <= month <= 12:
        raise HTTPException(status_code=400, detail="invalid expiry month")
    return month, year


async def _methods_for_company(db: AsyncSession, cid: str) -> list[PaymentMethod]:
    q = await db.execute(
        select(PaymentMethod)
        .where(PaymentMethod.company_id == cid)
        .order_by(PaymentMethod.is_primary.desc(), PaymentMethod.created_at.desc())
    )
    return list(q.scalars().all())


def _pm_to_out(m: PaymentMethod) -> PaymentMethodOut:
    return PaymentMethodOut(
        id=m.id,
        company_id=m.company_id,
        type=m.method_type.value,
        brand=m.brand,
        bank_name=m.bank_name,
        last4=m.last4,
        expiry_month=m.expiry_month,
        expiry_year=m.expiry_year,
        rail=m.rail.value if m.rail else None,
        holder_name=m.holder_name,
        is_primary=m.is_primary,
        created_at=m.created_at,
    )


async def _clear_primary(db: AsyncSession, cid: str) -> None:
    await db.execute(
        update(PaymentMethod).where(PaymentMethod.company_id == cid).values(is_primary=False)
    )


@router.get("/methods", response_model=list[PaymentMethodOut])
async def list_methods(db: Db, user: AdminUser, cid: CompanyId) -> list[PaymentMethodOut]:
    _ = user
    rows = await _methods_for_company(db, cid)
    return [_pm_to_out(m) for m in rows]


@router.post("/methods", response_model=PaymentMethodOut, status_code=status.HTTP_201_CREATED)
async def create_method(db: Db, user: AdminUser, cid: CompanyId, body: PaymentMethodCreate) -> PaymentMethodOut:
    _ = user
    existing = await _methods_for_company(db, cid)
    has_primary = any(m.is_primary for m in existing)

    if body.type == "card":
        if not body.card:
            raise HTTPException(status_code=400, detail="card details required")
        c = body.card
        digits = "".join(x for x in c.card_number if x.isdigit())
        if len(digits) < 4:
            raise HTTPException(status_code=400, detail="card_number must have at least 4 digits")
        last4 = digits[-4:]
        month, year = _parse_expiry(c.expiry)
        brand = _brand_from_pan(digits)
        want_primary = c.is_primary or not has_primary
        if want_primary:
            await _clear_primary(db, cid)
        pm = PaymentMethod(
            id=str(uuid4()),
            company_id=cid,
            method_type=PaymentMethodKind.card,
            brand=brand,
            last4=last4,
            expiry_month=month,
            expiry_year=year,
            holder_name=c.holder_name.strip(),
            is_primary=want_primary,
        )
    else:
        if not body.bank:
            raise HTTPException(status_code=400, detail="bank details required")
        b = body.bank
        try:
            rail = PaymentRail(b.rail)
        except ValueError:
            raise HTTPException(status_code=400, detail="invalid rail")
        want_primary = b.is_primary or not has_primary
        if want_primary:
            await _clear_primary(db, cid)
        pm = PaymentMethod(
            id=str(uuid4()),
            company_id=cid,
            method_type=PaymentMethodKind.bank,
            bank_name=b.bank_name.strip(),
            last4=b.account_last4,
            rail=rail,
            is_primary=want_primary,
        )

    db.add(pm)
    await db.commit()
    await db.refresh(pm)
    return _pm_to_out(pm)


@router.delete("/methods/{method_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_method(db: Db, user: AdminUser, cid: CompanyId, method_id: str) -> None:
    _ = user
    pm = await db.get(PaymentMethod, method_id)
    if not pm or pm.company_id != cid:
        raise HTTPException(status_code=404, detail="Payment method not found")
    was_primary = pm.is_primary
    await db.execute(delete(PaymentMethod).where(PaymentMethod.id == method_id))
    await db.commit()
    if was_primary:
        rest = await _methods_for_company(db, cid)
        if rest:
            await _clear_primary(db, cid)
            rest[0].is_primary = True
            await db.commit()


@router.patch("/methods/{method_id}/set-primary", response_model=PaymentMethodOut)
async def set_primary(db: Db, user: AdminUser, cid: CompanyId, method_id: str) -> PaymentMethodOut:
    _ = user
    pm = await db.get(PaymentMethod, method_id)
    if not pm or pm.company_id != cid:
        raise HTTPException(status_code=404, detail="Payment method not found")
    await _clear_primary(db, cid)
    pm.is_primary = True
    await db.commit()
    await db.refresh(pm)
    return _pm_to_out(pm)


@router.get("/invoices", response_model=InvoiceListOut)
async def list_invoices(
    db: Db,
    user: AdminUser,
    cid: CompanyId,
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> InvoiceListOut:
    _ = user
    cstmt = select(func.count()).select_from(Invoice).where(Invoice.company_id == cid)
    total = int((await db.execute(cstmt)).scalar_one() or 0)
    stmt = (
        select(Invoice)
        .where(Invoice.company_id == cid)
        .order_by(Invoice.issued_at.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return InvoiceListOut(
        items=[
            InvoiceOut(
                id=r.id,
                company_id=r.company_id,
                amount=Decimal(str(r.amount)),
                currency=r.currency,
                status=r.status.value,
                issued_at=r.issued_at,
                paid_at=r.paid_at,
                reference_number=r.reference_number,
            )
            for r in rows
        ],
        total=total,
    )


@router.get("/summary", response_model=PaymentSummaryOut)
async def payment_summary(db: Db, user: AdminUser, cid: CompanyId) -> PaymentSummaryOut:
    _ = user
    now = datetime.now(timezone.utc)
    pending = await db.execute(
        select(Invoice)
        .where(Invoice.company_id == cid, Invoice.status == InvoiceStatus.pending)
        .order_by(Invoice.issued_at.asc())
        .limit(1)
    )
    row = pending.scalar_one_or_none()
    if row:
        next_dt = row.issued_at + timedelta(days=14)
    else:
        next_dt = now + timedelta(days=30)
        next_dt = next_dt.replace(hour=0, minute=0, second=0, microsecond=0)
    return PaymentSummaryOut(next_billing_date=next_dt, billing_cycle="Monthly")
