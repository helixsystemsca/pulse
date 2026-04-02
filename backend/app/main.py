"""
Operations Intelligence Platform — FastAPI entrypoint.

Layers:
- `app/core`: event bus, state, inference, feature flags, auth helpers
- `app/modules/*`: optional product modules (feature-flagged per company), e.g. Pulse REST
- `app/api`: HTTP surface — `/api/public`, `/api` (compliance), `/api/system`, `/api/v1` (auth, pulse, …)
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.admin_routes import router as admin_router
from app.api.automation_debug_routes import router as automation_debug_router
from app.api.automation_events_routes import router as automation_events_router
from app.api.devices_routes import router as devices_router
from app.api.notifications_routes import router as notifications_router
from app.api.auth_routes import router as auth_router
from app.api.compliance_routes import router as compliance_router
from app.api.payments_routes import router as payments_router
from app.api.core_routes import router as core_router
from app.api.public_routes import router as public_router
from app.api.realtime import router as realtime_router
from app.api.system_routes import router as system_router
from app.api.users_routes import router as users_router
from app.api.work_requests_routes import router as work_requests_router
from app.api.workers_routes import router as workers_router
from app.api.inventory_portal_routes import router as inventory_portal_router
from app.core.bootstrap import ensure_bootstrap_system_admin
from app.core.config import get_settings
from app.core.database import AsyncSessionLocal
from app.limiter import limiter
from app.middleware.feature_gate import FeatureGateMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.modules.pulse.router import router as pulse_router
from app.modules.registry import register_modules

settings = get_settings()

_cors_origins = settings.cors_origin_list
_cors_log = logging.getLogger(__name__)
_cors_log.info(
    "CORS allow_origins (%d): %s; regex: %s",
    len(_cors_origins),
    _cors_origins,
    settings.cors_origin_regex_pattern or "(none)",
)
if not _cors_origins and not settings.cors_origin_regex_pattern:
    _cors_log.warning(
        "CORS_ORIGINS is empty and CORS_ORIGIN_REGEX unset — cross-origin browser requests will fail. "
        "Include the Pulse app origin (e.g. https://pulse.helixsystems.ca): set CORS_ORIGINS with comma-separated "
        "Origins (no trailing slash), set CORS_ORIGIN_REGEX, or set PULSE_APP_PUBLIC_URL (its origin is merged into CORS).",
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with AsyncSessionLocal() as db:
        await ensure_bootstrap_system_admin(db)
    yield


_doc_kwargs: dict = {}
if settings.is_production:
    _doc_kwargs = {"docs_url": None, "redoc_url": None, "openapi_url": None}

app = FastAPI(
    title="Operations Intelligence Platform",
    version="0.1.0",
    lifespan=lifespan,
    **_doc_kwargs,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# First registered sits innermost (just above routes); last registered is outermost.
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(
    SecurityHeadersMiddleware,
    enable_hsts=settings.enable_hsts,
)
app.add_middleware(FeatureGateMiddleware)
if settings.trusted_host_list:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_host_list)
# CORS must be outermost so responses from inner middleware (e.g. TrustedHost 400) still get ACAO on preflight/POST.
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=settings.cors_origin_regex_pattern,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(public_router, prefix="/api/public")
app.include_router(compliance_router, prefix="/api")
app.include_router(work_requests_router, prefix="/api")
app.include_router(workers_router, prefix="/api")
app.include_router(inventory_portal_router, prefix="/api")
app.include_router(payments_router, prefix="/api")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(automation_events_router, prefix="/api/v1")
app.include_router(automation_debug_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")
app.include_router(devices_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(system_router, prefix="/api/system")
app.include_router(users_router, prefix="/api/v1")
app.include_router(core_router, prefix="/api/v1")
app.include_router(realtime_router, prefix="/api/v1")
app.include_router(pulse_router, prefix="/api/v1")

register_modules(app)
