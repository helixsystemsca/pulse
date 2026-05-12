"""Read-only queries for append-only procedure acknowledgment audit listings."""

from __future__ import annotations

from datetime import date, datetime, time, timezone
from typing import Literal, Optional

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import User
from app.models.pulse_models import PulseProcedure, PulseProcedureTrainingAcknowledgement

ProcedureAckComplianceStatus = Literal["current", "outdated"]


def _end_of_utc_day(d: date) -> datetime:
    return datetime.combine(d, time(23, 59, 59, 999999), tzinfo=timezone.utc)


def _archive_where(
    company_id: str,
    *,
    worker_id: Optional[str],
    procedure_id: Optional[str],
    revision: Optional[int],
    status_filter: Literal["all", "current", "outdated"],
    date_from: Optional[date],
    date_to: Optional[date],
):
    conds = [
        PulseProcedureTrainingAcknowledgement.company_id == company_id,
        PulseProcedure.company_id == company_id,
    ]
    if worker_id:
        conds.append(PulseProcedureTrainingAcknowledgement.employee_user_id == worker_id)
    if procedure_id:
        conds.append(PulseProcedureTrainingAcknowledgement.procedure_id == procedure_id)
    if revision is not None:
        conds.append(PulseProcedureTrainingAcknowledgement.revision_number == int(revision))
    if date_from is not None:
        conds.append(
            PulseProcedureTrainingAcknowledgement.acknowledged_at
            >= datetime.combine(date_from, time.min, tzinfo=timezone.utc)
        )
    if date_to is not None:
        conds.append(PulseProcedureTrainingAcknowledgement.acknowledged_at <= _end_of_utc_day(date_to))
    if status_filter == "current":
        conds.append(PulseProcedureTrainingAcknowledgement.revision_number == PulseProcedure.content_revision)
    elif status_filter == "outdated":
        conds.append(PulseProcedureTrainingAcknowledgement.revision_number < PulseProcedure.content_revision)
    return and_(*conds)


async def count_procedure_acknowledgment_archive(
    db: AsyncSession,
    company_id: str,
    *,
    worker_id: Optional[str] = None,
    procedure_id: Optional[str] = None,
    revision: Optional[int] = None,
    status_filter: Literal["all", "current", "outdated"] = "all",
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> int:
    stmt = (
        select(func.count())
        .select_from(PulseProcedureTrainingAcknowledgement)
        .join(PulseProcedure, PulseProcedure.id == PulseProcedureTrainingAcknowledgement.procedure_id)
        .where(
            _archive_where(
                company_id,
                worker_id=worker_id,
                procedure_id=procedure_id,
                revision=revision,
                status_filter=status_filter,
                date_from=date_from,
                date_to=date_to,
            )
        )
    )
    r = await db.execute(stmt)
    return int(r.scalar_one() or 0)


async def list_procedure_acknowledgment_archive(
    db: AsyncSession,
    company_id: str,
    *,
    worker_id: Optional[str] = None,
    procedure_id: Optional[str] = None,
    revision: Optional[int] = None,
    status_filter: Literal["all", "current", "outdated"] = "all",
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    j = (
        select(
            PulseProcedureTrainingAcknowledgement,
            User.full_name,
            PulseProcedure.title,
            PulseProcedure.content_revision,
        )
        .join(User, User.id == PulseProcedureTrainingAcknowledgement.employee_user_id)
        .join(PulseProcedure, PulseProcedure.id == PulseProcedureTrainingAcknowledgement.procedure_id)
        .where(
            _archive_where(
                company_id,
                worker_id=worker_id,
                procedure_id=procedure_id,
                revision=revision,
                status_filter=status_filter,
                date_from=date_from,
                date_to=date_to,
            )
        )
        .order_by(PulseProcedureTrainingAcknowledgement.acknowledged_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = await db.execute(j)
    out: list[dict] = []
    for ack, emp_name, title, cur_rev in rows.all():
        cur = int(cur_rev or 1)
        ar = int(ack.revision_number or 1)
        status: ProcedureAckComplianceStatus = "current" if ar >= cur else "outdated"
        out.append(
            {
                "id": str(ack.id),
                "employee_user_id": str(ack.employee_user_id),
                "employee_name": (str(emp_name).strip() if emp_name else "") or "—",
                "procedure_id": str(ack.procedure_id),
                "procedure_title": str(title or "").strip() or "—",
                "acknowledged_revision": ar,
                "procedure_current_revision": cur,
                "acknowledged_at": ack.acknowledged_at,
                "acknowledgment_statement": ack.acknowledgment_statement,
                "acknowledgment_note": ack.acknowledgment_note,
                "compliance_status": status,
            }
        )
    return out
