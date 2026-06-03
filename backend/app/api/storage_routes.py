"""Storage backend health diagnostics."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, status
from starlette.responses import JSONResponse

from app.api.deps import require_system_admin
from app.core.storage import run_storage_health_check
from app.models.domain import User

router = APIRouter(prefix="/storage", tags=["storage"])


@router.get("/health")
async def storage_health(
    _: Annotated[User, Depends(require_system_admin)],
) -> JSONResponse:
    """
    Verify object storage: bucket access (S3/R2), upload, exists, and delete permissions.
    Does not log credentials.
    """
    report: dict[str, Any] = run_storage_health_check()
    code = status.HTTP_200_OK if report.get("overall_ok") else status.HTTP_503_SERVICE_UNAVAILABLE
    return JSONResponse(content=report, status_code=code)
