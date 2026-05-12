"""Lightweight procedure completion (checkbox acknowledgment) + training matrix sync."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pulse_models import PulseProcedure, PulseProcedureComplianceSettings, PulseProcedureWorkerCompletion
from app.schemas.training import ProcedureLightCompletionStatusApi
from app.services.procedure_training.service import (
    record_procedure_acknowledgement,
    record_procedure_signoff,
    resolve_compliance_defaults,
    revision_marker_from_procedure,
    verification_requires_quiz,
)


async def get_light_completion_state(
    db: AsyncSession,
    company_id: str,
    *,
    employee_user_id: str,
    procedure: PulseProcedure,
) -> tuple[ProcedureLightCompletionStatusApi, Optional[PulseProcedureWorkerCompletion]]:
    """Latest completion row for this user+procedure (any revision), compared to current procedure revision."""
    rev = int(procedure.content_revision or 1)
    today = datetime.now(timezone.utc).date()

    q = await db.execute(
        select(PulseProcedureWorkerCompletion)
        .where(
            PulseProcedureWorkerCompletion.company_id == company_id,
            PulseProcedureWorkerCompletion.employee_user_id == employee_user_id,
            PulseProcedureWorkerCompletion.procedure_id == str(procedure.id),
        )
        .order_by(PulseProcedureWorkerCompletion.revision_number.desc())
    )
    rows = list(q.scalars().all())
    if not rows:
        return "not_started", None

    latest = rows[0]
    if latest.revision_number < rev:
        return "requires_retraining", latest

    if latest.revision_number > rev:
        return "not_started", None

    if latest.expires_at is not None and latest.expires_at < today:
        return "expired", latest

    return "completed", latest


async def submit_light_procedure_completion(
    db: AsyncSession,
    company_id: str,
    *,
    employee_user_id: str,
    procedure: PulseProcedure,
    cs: PulseProcedureComplianceSettings | None,
    completed_by_user_id: str,
    primary_acknowledged: bool,
    secondary_acknowledged: bool,
    supervisor_signoff: bool,
) -> tuple[PulseProcedureWorkerCompletion, Optional[str]]:
    if not primary_acknowledged:
        raise ValueError("primary_acknowledged is required")

    if verification_requires_quiz(cs):
        raise ValueError("Knowledge verification is enabled; use the verification flow instead of lightweight completion.")

    if bool(getattr(procedure, "is_critical", False)) and not secondary_acknowledged:
        raise ValueError("Critical procedures require the secondary acknowledgment checkbox.")

    rev = int(procedure.content_revision or 1)
    now = datetime.now(timezone.utc)
    today = now.date()

    exist_q = await db.execute(
        select(PulseProcedureWorkerCompletion).where(
            PulseProcedureWorkerCompletion.company_id == company_id,
            PulseProcedureWorkerCompletion.employee_user_id == employee_user_id,
            PulseProcedureWorkerCompletion.procedure_id == str(procedure.id),
            PulseProcedureWorkerCompletion.revision_number == rev,
        )
    )
    row = exist_q.scalar_one_or_none()
    if row is not None:
        if row.expires_at is None or row.expires_at >= today:
            raise ValueError("Already completed for this procedure version.")
        # Renew after expiry — reuse row
        row.completed_at = now
        row.expires_at = None
        row.primary_acknowledged_at = now
        row.secondary_acknowledged_at = now if secondary_acknowledged else None
        row.quiz_score_percent = None
    else:
        row = PulseProcedureWorkerCompletion(
            id=str(uuid4()),
            company_id=company_id,
            employee_user_id=employee_user_id,
            procedure_id=str(procedure.id),
            revision_number=rev,
            completed_at=now,
            expires_at=None,
            primary_acknowledged_at=now,
            secondary_acknowledged_at=now if secondary_acknowledged else None,
            quiz_score_percent=None,
        )
        db.add(row)

    await db.flush()

    _, req_ack, _ = resolve_compliance_defaults(cs)
    pdf_snapshot_id: Optional[str] = None
    if bool(req_ack):
        _ak, created, snap_id = await record_procedure_acknowledgement(
            db, company_id, employee_user_id=employee_user_id, procedure=procedure
        )
        if created and snap_id:
            pdf_snapshot_id = snap_id

    marker = revision_marker_from_procedure(procedure)
    await record_procedure_signoff(
        db,
        company_id,
        employee_user_id=employee_user_id,
        procedure=procedure,
        completed_by_user_id=completed_by_user_id,
        supervisor_signoff=supervisor_signoff,
        revision_marker=marker,
    )

    await db.flush()
    return row, pdf_snapshot_id
