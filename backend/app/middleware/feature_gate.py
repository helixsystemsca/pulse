"""
Feature gate middleware — module paths require JWT + enabled company feature.
system_admin bypasses (use impersonation to exercise tenant modules).
"""

from __future__ import annotations

import logging

from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.types import ASGIApp

from app.core.auth.security import decode_token
from app.core.database import AsyncSessionLocal
from app.core.features.paths import required_feature_for_path
from app.core.features.service import FeatureFlagService

logger = logging.getLogger(__name__)


class FeatureGateMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)

        path = request.url.path
        feature = required_feature_for_path(path)
        if feature is None:
            return await call_next(request)
        keys = (feature,) if isinstance(feature, str) else tuple(feature)

        auth = request.headers.get("authorization")
        if not auth or not auth.lower().startswith("bearer "):
            return JSONResponse(
                status_code=401,
                content={"detail": "not_authenticated"},
            )
        token = auth.split(None, 1)[1] if len(auth.split()) > 1 else ""
        try:
            payload = decode_token(token)
            company_id = payload.get("company_id")
            if company_id is None:
                return JSONResponse(
                    status_code=401,
                    content={"detail": "company_context_required_impersonate"},
                )
            company_id = str(company_id)
        except Exception:
            return JSONResponse(
                status_code=401,
                content={"detail": "invalid_token"},
            )

        try:
            async with AsyncSessionLocal() as session:
                svc = FeatureFlagService(session)
                if not await svc.any_enabled(company_id, keys):
                    return JSONResponse(
                        status_code=403,
                        content={
                            "detail": "feature_disabled",
                            "feature": keys if len(keys) > 1 else keys[0],
                        },
                    )
        except Exception:
            logger.exception("feature gate lookup failed for company=%s", company_id)
            return JSONResponse(
                status_code=503,
                content={"detail": "feature_check_unavailable"},
            )

        return await call_next(request)
