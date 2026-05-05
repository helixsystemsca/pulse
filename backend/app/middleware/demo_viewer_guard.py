"""
Demo Viewer write guard.

Goal: allow demo accounts to browse safely while preventing destructive/mutating actions.
Implementation is intentionally lightweight: it inspects the JWT `role` claim (no DB hit)
and blocks non-GET methods for `demo_viewer` except a small allowlist.
"""

from __future__ import annotations

from typing import Iterable

from fastapi import HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.auth.security import decode_token


_MUTATING_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})


def _path_allowed(path: str, allow_prefixes: Iterable[str]) -> bool:
    for p in allow_prefixes:
        if path == p or path.startswith(p.rstrip("/") + "/"):
            return True
    return False


class DemoViewerGuardMiddleware(BaseHTTPMiddleware):
    """
    Blocks mutating requests for demo_viewer accounts.

    Notes:
    - Uses JWT `role` claim (set from DB roles at login).
    - Does not attempt to classify endpoints; it blocks by HTTP method with an allowlist.
    """

    def __init__(self, app, *, allow_mutating_prefixes: list[str] | None = None):
        super().__init__(app)
        self._allow_mutating_prefixes = allow_mutating_prefixes or []

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.method.upper() not in _MUTATING_METHODS:
            return await call_next(request)

        auth = request.headers.get("authorization") or ""
        if not auth.lower().startswith("bearer "):
            return await call_next(request)

        token = auth.split(None, 1)[1].strip()
        try:
            payload = decode_token(token)
        except Exception:
            # Leave auth failures to route dependencies.
            return await call_next(request)

        if str(payload.get("role") or "").strip() != "demo_viewer":
            return await call_next(request)

        path = request.url.path or ""
        if _path_allowed(path, self._allow_mutating_prefixes):
            return await call_next(request)

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo Mode — changes are disabled for this account",
        )

