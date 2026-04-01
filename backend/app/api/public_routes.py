"""Unauthenticated public endpoints (e.g. marketing contact)."""

from __future__ import annotations

import re

from fastapi import APIRouter, HTTPException, Request, status

from app.core.config import get_settings
from app.core.email_smtp import send_contact_lead
from app.limiter import limiter
from app.schemas.contact import PublicContactIn

router = APIRouter(tags=["public"])
_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


@router.post("/contact", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("8/minute")
async def submit_contact(request: Request, body: PublicContactIn) -> dict[str, str | bool]:
    """
    Accepts contact form from helixsystems.ca; emails info@ via SMTP (noreply From, visitor Reply-To).
    """
    settings = get_settings()
    if not settings.smtp_configured:
        raise HTTPException(
            status_code=503,
            detail="Contact delivery is not configured. Email info@helixsystems.ca directly.",
        )
    email = body.email.strip()
    if not _EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Invalid email")

    ok = await send_contact_lead(
        settings,
        from_name=body.name.strip(),
        from_email=email,
        company=body.company.strip(),
        message=body.message.strip(),
    )
    if not ok:
        raise HTTPException(status_code=502, detail="Could not send message. Try again or email info@helixsystems.ca.")
    return {"ok": True, "detail": "Message sent"}
