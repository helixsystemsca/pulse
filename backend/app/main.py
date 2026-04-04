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
from app.api.automation_config_routes import router as automation_config_router
from app.api.devices_routes import router as devices_router
from app.api.equipment_routes import router as equipment_router
from app.api.notifications_routes import router as notifications_router
from app.api.onboarding_routes import router as onboarding_router
from app.api.auth_routes import router as auth_router
from app.api.company_routes import router as company_router
from app.api.compliance_routes import router as compliance_router
from app.api.projects_routes import router as projects_router
from app.api.projects_routes import tasks_router as projects_tasks_router
from app.api.monitoring_routes import router as monitoring_router
from app.api.operations_routes import router as operations_router
from app.api.proximity_routes import router as proximity_router
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
        "Include every site Origin (e.g. https://pulse.helixsystems.ca, https://www.helixsystems.ca): CORS_ORIGINS "
        "(no trailing slash), CORS_EXTRA_ORIGINS, CORS_ORIGIN_REGEX, and/or PULSE_APP_PUBLIC_URL (origin merged).",
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
app.include_router(auth_router, prefix="/api/v1")
app.include_router(onboarding_router, prefix="/api/v1")
app.include_router(company_router, prefix="/api/v1")
app.include_router(automation_events_router, prefix="/api/v1")
app.include_router(automation_debug_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")
app.include_router(devices_router, prefix="/api/v1")
app.include_router(equipment_router, prefix="/api/v1")
app.include_router(automation_config_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(system_router, prefix="/api/system")
app.include_router(users_router, prefix="/api/v1")
app.include_router(core_router, prefix="/api/v1")
app.include_router(realtime_router, prefix="/api/v1")
app.include_router(pulse_router, prefix="/api/v1")
app.include_router(projects_router, prefix="/api/v1")
app.include_router(projects_tasks_router, prefix="/api/v1")
app.include_router(proximity_router, prefix="/api/v1")
app.include_router(operations_router, prefix="/api/v1")
app.include_router(monitoring_router, prefix="/api/v1")

register_modules(app)
