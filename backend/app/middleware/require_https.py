"""Reject cleartext HTTP when REQUIRE_HTTPS is enabled (TLS termination at load balancer)."""

from __future__ import annotations

import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.types import ASGIApp

logger = logging.getLogger(__name__)


def _effective_scheme(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-proto")
    if forwarded:
        return forwarded.split(",")[0].strip().lower()
    return request.url.scheme.lower()


class RequireHttpsMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp, *, enabled: bool) -> None:
        super().__init__(app)
        self._enabled = enabled

    async def dispatch(self, request: Request, call_next):
        if not self._enabled:
            return await call_next(request)
        if request.method == "OPTIONS":
            return await call_next(request)
        if _effective_scheme(request) != "https":
            client = request.client.host if request.client else ""
            logger.warning("blocked_non_https method=%s path=%s client=%s", request.method, request.url.path, client)
            return JSONResponse(
                status_code=403,
                content={"detail": "https_required"},
            )
        return await call_next(request)
