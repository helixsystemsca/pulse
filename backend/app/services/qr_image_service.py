"""PNG/SVG QR generation for printable asset labels (no third-party image CDN)."""

from __future__ import annotations

import io

import qrcode
from qrcode.image.svg import SvgPathImage

from app.services.qr_resource_service import build_qr_url


def qr_payload_url(token: str) -> str:
    url = build_qr_url(token)
    if url.startswith("/"):
        # Phones cannot open path-only codes; callers should prefer an absolute public URL.
        return url
    return url


def render_qr_png(token: str, *, box_size: int = 8, border: int = 2) -> bytes:
    img = qrcode.make(qr_payload_url(token), box_size=box_size, border=border)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def render_qr_svg(token: str) -> bytes:
    factory = SvgPathImage
    img = qrcode.make(qr_payload_url(token), image_factory=factory, border=2)
    buf = io.BytesIO()
    img.save(buf)
    return buf.getvalue()
