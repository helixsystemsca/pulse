from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import CurrentUser
from app.schemas.dashboard import DashboardSummary
from app.services import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
async def summary(
    current: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> DashboardSummary:
    data = await dashboard_service.summary(db, current.company_id)
    return DashboardSummary(**data)
