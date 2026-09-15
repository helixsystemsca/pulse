"""
Feature gate middleware — module paths require JWT + enabled company feature.
system_admin bypasses (use impersonation to exercise tenant modules).
"""

from __future__ import annotations

import logging

from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.types import ASGIApp

from app.core.auth.security import decode_token
from app.core.database import AsyncSessionLocal
from app.core.features.paths import required_feature_for_path
from app.core.features.service import FeatureFlagService
from app.core.security.tenant_rls import (
    apply_pulse_rls_auth_bootstrap_context,
    apply_pulse_rls_context,
    apply_pulse_rls_context_for_user,
)
from app.middleware.cors_helpers import apply_cors_headers
from app.models.domain import User

logger = logging.getLogger(__name__)


async def apply_feature_gate_rls_context(session: AsyncSession, payload: dict, company_id: str) -> None:
    """
    FeatureFlagService reads ``companies`` / ``company_features``. Those tables use FORCE RLS.

    ``FeatureGateMiddleware`` opens its own session (not ``get_db``), so it must set the same
    ``pulse.company_id`` / ``pulse.is_system_admin`` GUCs as ``get_current_user`` or
    ``_frozen_enabled`` sees an empty tenant and returns ``feature_disabled``.
    """
    await apply_pulse_rls_auth_bootstrap_context(session)
    sub = payload.get("sub")
    user = None
    if sub:
        user = (await session.execute(select(User).where(User.id == str(sub)))).scalar_one_or_none()
    if user is not None:
        await apply_pulse_rls_context_for_user(session, user)
        return
    await apply_pulse_rls_context(session, company_id=company_id, is_system_admin=False)


class FeatureGateMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    def _json(self, request: Request, *, status_code: int, content: dict) -> JSONResponse:
        return apply_cors_headers(request, JSONResponse(status_code=status_code, content=content))

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
            return self._json(request, status_code=401, content={"detail": "not_authenticated"})
        token = auth.split(None, 1)[1] if len(auth.split()) > 1 else ""
        try:
            payload = decode_token(token)
            company_id = payload.get("company_id")
            if company_id is None:
                return self._json(
                    request,
                    status_code=401,
                    content={"detail": "company_context_required_impersonate"},
                )
            company_id = str(company_id)
        except Exception:
            return self._json(request, status_code=401, content={"detail": "invalid_token"})

        try:
            async with AsyncSessionLocal() as session:
                await apply_feature_gate_rls_context(session, payload, company_id)
                svc = FeatureFlagService(session)
                if not await svc.any_enabled(company_id, keys):
                    return self._json(
                        request,
                        status_code=403,
                        content={
                            "detail": "feature_disabled",
                            "feature": keys if len(keys) > 1 else keys[0],
                        },
                    )
        except Exception:
            logger.exception("feature gate lookup failed for company=%s", company_id)
            return self._json(request, status_code=503, content={"detail": "feature_check_unavailable"})

        return await call_next(request)
