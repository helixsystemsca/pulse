"""In-app employee certification expiry (30/60/90) — no email/SMTP."""

from __future__ import annotations

from datetime import date
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import User
from app.models.pulse_models import PulseWorkerCertification
from app.services.ops_compliance_dates import classify_expiry, days_until, utc_today


async def certification_expiry_summary(
    db: AsyncSession,
    company_id: str,
    *,
    today: Optional[date] = None,
) -> dict[str, Any]:
    today = today or utc_today()
    rows = list(
        (
            await db.execute(
                select(PulseWorkerCertification, User)
                .join(User, User.id == PulseWorkerCertification.user_id)
                .where(
                    PulseWorkerCertification.company_id == company_id,
                    User.company_id == company_id,
                    User.is_active.is_(True),
                )
            )
        ).all()
    )

    buckets: dict[str, list[dict[str, Any]]] = {
        "expired": [],
        "expiring_30": [],
        "expiring_60": [],
        "expiring_90": [],
        "ok": [],
        "missing": [],
    }
    items: list[dict[str, Any]] = []
    for cert, user in rows:
        expiry = cert.expiry_date.date() if cert.expiry_date else None
        status = classify_expiry(expiry, today=today)
        payload = {
            "id": str(cert.id),
            "user_id": str(user.id),
            "worker_name": user.full_name or user.email,
            "email": user.email,
            "name": cert.name,
            "expiry_date": expiry.isoformat() if expiry else None,
            "days": days_until(expiry, today=today),
            "status": status,
            "href": "/training/compliance/workers?panel=certifications",
        }
        items.append(payload)
        buckets[status].append(payload)

    attention = buckets["expired"] + buckets["expiring_30"] + buckets["expiring_60"] + buckets["expiring_90"]
    attention.sort(key=lambda r: (r["days"] is None, r["days"] if r["days"] is not None else 0, r["name"]))

    return {
        "today": today.isoformat(),
        "counts": {
            "expired": len(buckets["expired"]),
            "expiring_30": len(buckets["expiring_30"]),
            "expiring_60": len(buckets["expiring_60"]),
            "expiring_90": len(buckets["expiring_90"]),
            "ok": len(buckets["ok"]),
            "no_expiry": len(buckets["missing"]),
            "attention": len(attention),
            "total": len(items),
        },
        "expired": buckets["expired"],
        "expiring_30": buckets["expiring_30"],
        "expiring_60": buckets["expiring_60"],
        "expiring_90": buckets["expiring_90"],
        "attention": attention,
        "items": items,
    }
