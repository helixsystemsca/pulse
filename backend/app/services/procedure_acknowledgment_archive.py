"""Read-only queries for append-only procedure acknowledgment audit listings."""

from __future__ import annotations

from datetime import date, datetime, time, timezone
from typing import Literal, Optional

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import User
from app.models.pulse_models import (
    PulseProcedure,
    PulseProcedureAcknowledgmentSnapshot,
    PulseProcedureTrainingAcknowledgement,
)

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
            PulseProcedureAcknowledgmentSnapshot.id,
            PulseProcedureAcknowledgmentSnapshot.generated_pdf_url,
            PulseProcedureAcknowledgmentSnapshot.pdf_generation_error,
        )
        .join(User, User.id == PulseProcedureTrainingAcknowledgement.employee_user_id)
        .join(PulseProcedure, PulseProcedure.id == PulseProcedureTrainingAcknowledgement.procedure_id)
        .outerjoin(
            PulseProcedureAcknowledgmentSnapshot,
            PulseProcedureAcknowledgmentSnapshot.acknowledgment_id == PulseProcedureTrainingAcknowledgement.id,
        )
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
    for row_pack in rows.all():
        ack, emp_name, title, cur_rev, snap_id, pdf_url, pdf_err = row_pack
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
                "snapshot_id": str(snap_id) if snap_id else None,
                "pdf_ready": bool(pdf_url),
                "pdf_generation_error": (str(pdf_err).strip() if pdf_err else None),
            }
        )
    return out


async def get_procedure_acknowledgment_compliance_record(
    db: AsyncSession,
    company_id: str,
    acknowledgment_id: str,
) -> Optional[dict]:
    """Return immutable snapshot + live revision status for one acknowledgment (or None if missing / no snapshot)."""
    ack = await db.get(PulseProcedureTrainingAcknowledgement, acknowledgment_id)
    if ack is None or str(ack.company_id) != str(company_id):
        return None
    proc = await db.get(PulseProcedure, ack.procedure_id)
    if proc is None or str(proc.company_id) != str(company_id):
        return None
    q = await db.execute(
        select(PulseProcedureAcknowledgmentSnapshot).where(
            PulseProcedureAcknowledgmentSnapshot.acknowledgment_id == str(ack.id)
        )
    )
    snap = q.scalar_one_or_none()
    if snap is None:
        return None
    cur = int(proc.content_revision or 1)
    ar = int(ack.revision_number or 1)
    status: ProcedureAckComplianceStatus = "current" if ar >= cur else "outdated"
    return {
        "acknowledgment_id": str(ack.id),
        "snapshot_id": str(snap.id),
        "immutable": True,
        "employee_user_id": str(ack.employee_user_id),
        "procedure_id": str(ack.procedure_id),
        "procedure_title_snapshot": str(snap.procedure_title or "").strip() or "—",
        "procedure_category_snapshot": snap.procedure_category,
        "procedure_semantic_version_snapshot": snap.procedure_semantic_version,
        "procedure_version_snapshot": int(snap.procedure_version or 1),
        "procedure_revision_date_snapshot": snap.procedure_revision_date,
        "procedure_revision_summary_snapshot": snap.procedure_revision_summary,
        "procedure_content_snapshot": snap.procedure_content_snapshot,
        "acknowledgment_statement_text": snap.acknowledgment_statement_text,
        "acknowledgment_note": ack.acknowledgment_note,
        "acknowledged_at": snap.acknowledged_at,
        "worker_full_name": snap.worker_full_name,
        "worker_job_title": snap.worker_job_title,
        "worker_operational_role": snap.worker_operational_role,
        "snapshot_created_at": snap.created_at,
        "generated_pdf_ready": bool(snap.generated_pdf_url),
        "pdf_generation_error": snap.pdf_generation_error,
        "procedure_current_revision": cur,
        "compliance_status": status,
        "immutable": True,
    }
