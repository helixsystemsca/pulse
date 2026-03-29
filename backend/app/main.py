"""
Operations Intelligence Platform — FastAPI entrypoint.

Layers:
- `app/core`: event bus, state, inference, feature flags, auth helpers
- `app/modules/*`: optional product modules (feature-flagged per company)
- `app/api`: public HTTP surface (admin, auth, realtime)
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.admin_routes import router as admin_router
from app.api.auth_routes import router as auth_router
from app.api.core_routes import router as core_router
from app.api.realtime import router as realtime_router
from app.api.system_routes import router as system_router
from app.api.users_routes import router as users_router
from app.core.bootstrap import ensure_bootstrap_system_admin, ensure_pulse_bootstrap_tenant_admin
from app.core.config import get_settings
from app.core.database import AsyncSessionLocal
from app.limiter import limiter
from app.middleware.feature_gate import FeatureGateMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.modules.pulse.router import router as pulse_router
from app.modules.registry import register_modules

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with AsyncSessionLocal() as db:
        await ensure_bootstrap_system_admin(db)
        await ensure_pulse_bootstrap_tenant_admin(db)
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
)
if settings.trusted_host_list:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_host_list)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(system_router, prefix="/api/system")
app.include_router(users_router, prefix="/api/v1")
app.include_router(core_router, prefix="/api/v1")
app.include_router(realtime_router, prefix="/api/v1")
app.include_router(pulse_router, prefix="/api/v1")

register_modules(app)
