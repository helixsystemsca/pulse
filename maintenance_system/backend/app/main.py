from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.database import init_db
from app.routes import assets, auth, dashboard, pm, users, work_orders, work_requests
from app.seed import seed_demo_if_empty


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    await seed_demo_if_empty()
    yield


settings = get_settings()
app = FastAPI(
    title="Maintenance System API",
    description="Work requests, work orders, assets, and preventive maintenance — integration-ready module.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ValueError)
async def value_error_handler(_, exc: ValueError):
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.get("/health")
async def health():
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(users.router)
app.include_router(assets.router)
app.include_router(work_requests.router)
app.include_router(work_orders.router)
app.include_router(pm.router)
app.include_router(dashboard.router)
