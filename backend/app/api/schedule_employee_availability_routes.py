"""Employee availability API for the manual schedule builder."""

from __future__ import annotations

from datetime import date
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_company_admin, require_tenant_user
from app.core.config import get_settings
from app.models.domain import User
from app.schemas.employee_availability import EmployeeAvailabilityOut, EmployeeAvailabilitySeedResult
from app.services.schedule.employee_availability_service import (
    JUNE_2026_END,
    JUNE_2026_START,
    list_employee_availability,
    seed_june_2026_auxiliary,
)

router = APIRouter(prefix="/pulse/schedule/employee-availability", tags=["schedule-employee-availability"])

Db = Annotated[AsyncSession, Depends(get_db)]


def _company_id(user: User) -> str:
    if not user.company_id:
        raise HTTPException(status_code=400, detail="Tenant company required")
    return str(user.company_id)


@router.get("", response_model=list[EmployeeAvailabilityOut])
async def get_employee_availability(
    db: Db,
    user: Annotated[User, Depends(require_tenant_user)],
    from_date: date = Query(..., alias="from"),
    to_date: date = Query(..., alias="to"),
    employee_id: Optional[str] = Query(None),
) -> list[EmployeeAvailabilityOut]:
    if to_date < from_date:
        raise HTTPException(status_code=400, detail="to must be on or after from")
    rows = await list_employee_availability(
        db,
        _company_id(user),
        from_date,
        to_date,
        [employee_id] if employee_id else None,
    )
    return [EmployeeAvailabilityOut.model_validate(r) for r in rows]


@router.post(
    "/dev/seed-june-2026-aux",
    response_model=EmployeeAvailabilitySeedResult,
    status_code=status.HTTP_200_OK,
)
async def dev_seed_june_2026_auxiliary(
    db: Db,
    admin: Annotated[User, Depends(require_company_admin)],
) -> EmployeeAvailabilitySeedResult:
    settings = get_settings()
    if settings.is_production:
        raise HTTPException(status_code=404, detail="Not found")
    result = await seed_june_2026_auxiliary(db, _company_id(admin))
    return EmployeeAvailabilitySeedResult(
        employees_matched=result.employees_matched,
        employees_missing=result.employees_missing,
        entries_created=result.entries_created,
        entries_skipped_duplicates=result.entries_skipped_duplicates,
        wiped_rows=result.wiped_rows,
        execution_ms=result.execution_ms,
    )
