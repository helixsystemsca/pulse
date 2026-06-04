"""Apply CORS headers on early middleware responses (when the browser sent Origin)."""

from __future__ import annotations

import re

from starlette.requests import Request
from starlette.responses import Response

from app.core.config import get_settings


def origin_allowed(origin: str) -> bool:
    settings = get_settings()
    if origin in settings.cors_origin_list:
        return True
    pattern = settings.cors_origin_regex_pattern
    if pattern:
        return re.fullmatch(pattern, origin) is not None
    return False


def apply_cors_headers(request: Request, response: Response) -> Response:
    """Defense-in-depth: inner middleware may return before CORSMiddleware adds ACAO."""
    origin = (request.headers.get("origin") or "").strip()
    if not origin or not origin_allowed(origin):
        return response
    response.headers.setdefault("Access-Control-Allow-Origin", origin)
    response.headers.setdefault("Access-Control-Allow-Credentials", "true")
    vary = response.headers.get("vary") or response.headers.get("Vary") or ""
    if "origin" not in vary.lower():
        response.headers["vary"] = f"{vary}, Origin".strip(", ") if vary else "Origin"
    return response
