"""
Compliance domain logic used by `/api/compliance`: effective status (pending vs overdue vs ignored),
summary KPIs (rate, missed, high-risk joins to `ComplianceRule`), repeat-offender counts, SQL filters.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import ComplianceCategory, ComplianceRecord, ComplianceRecordStatus, ComplianceRule

R = ComplianceRecord  # shorthand for query builders

REPEAT_OFFENDER_THRESHOLD = 3
REPEAT_OFFENDER_DAYS = 30

EffectiveStatus = str  # completed | pending | overdue | ignored


def effective_status(row: ComplianceRecord, now: datetime) -> EffectiveStatus:
    if row.ignored:
        return "ignored"
    if row.status == ComplianceRecordStatus.completed:
        return "completed"
    if row.required_at < now:
        return "overdue"
    return "pending"


def missed_severity_for_count(missed: int) -> str:
    if missed >= 20:
        return "critical"
    if missed >= 5:
        return "warning"
    return "stable"


async def repeat_offender_user_ids(
    db: AsyncSession,
    company_id: str,
    now: datetime,
) -> set[str]:
    since = now - timedelta(days=REPEAT_OFFENDER_DAYS)
    pending_overdue = and_(
        R.status == ComplianceRecordStatus.pending,
        R.required_at < now,
        R.ignored.is_(False),
    )
    stmt = (
        select(R.user_id, func.count().label("c"))
        .where(
            R.company_id == company_id,
            R.created_at >= since,
            or_(R.ignored.is_(True), pending_overdue),
        )
        .group_by(R.user_id)
        .having(func.count() >= REPEAT_OFFENDER_THRESHOLD)
    )
    rows = (await db.execute(stmt)).all()
    return {str(r[0]) for r in rows}


async def summarize(
    db: AsyncSession,
    company_id: str,
    now: Optional[datetime] = None,
) -> dict:
    now = now or datetime.now(timezone.utc)
    window_start = now - timedelta(days=90)
    prev_window_start = now - timedelta(days=180)
    prev_window_end = window_start

    active_monitors_q = await db.execute(
        select(func.count()).select_from(ComplianceRule).where(ComplianceRule.company_id == company_id)
    )
    active_monitors = int(active_monitors_q.scalar_one() or 0)

    total_q = await db.execute(
        select(func.count())
        .select_from(R)
        .where(
            R.company_id == company_id,
            R.created_at >= window_start,
        )
    )
    total = int(total_q.scalar_one() or 0)

    completed_q = await db.execute(
        select(func.count())
        .select_from(R)
        .where(
            R.company_id == company_id,
            R.created_at >= window_start,
            R.status == ComplianceRecordStatus.completed,
            R.ignored.is_(False),
        )
    )
    completed = int(completed_q.scalar_one() or 0)

    compliance_rate = (completed / total * 100.0) if total > 0 else 100.0

    prev_total_q = await db.execute(
        select(func.count())
        .select_from(R)
        .where(
            R.company_id == company_id,
            R.created_at >= prev_window_start,
            R.created_at < prev_window_end,
        )
    )
    prev_total = int(prev_total_q.scalar_one() or 0)
    prev_completed_q = await db.execute(
        select(func.count())
        .select_from(R)
        .where(
            R.company_id == company_id,
            R.created_at >= prev_window_start,
            R.created_at < prev_window_end,
            R.status == ComplianceRecordStatus.completed,
            R.ignored.is_(False),
        )
    )
    prev_completed = int(prev_completed_q.scalar_one() or 0)
    prev_rate = (prev_completed / prev_total * 100.0) if prev_total > 0 else compliance_rate
    trend = compliance_rate - prev_rate

    overdue_part = and_(
        R.status == ComplianceRecordStatus.pending,
        R.ignored.is_(False),
        R.required_at < now,
    )
    missed_overdue_q = await db.execute(
        select(func.count()).select_from(R).where(R.company_id == company_id, overdue_part)
    )
    missed_ignored_q = await db.execute(
        select(func.count()).select_from(R).where(R.company_id == company_id, R.ignored.is_(True))
    )
    missed = int(missed_overdue_q.scalar_one() or 0) + int(missed_ignored_q.scalar_one() or 0)

    violation_clause = or_(R.ignored.is_(True), overdue_part)
    high_risk_q = await db.execute(
        select(func.count())
        .select_from(R)
        .join(ComplianceRule, ComplianceRule.tool_id == R.tool_id)
        .where(
            R.company_id == company_id,
            ComplianceRule.company_id == company_id,
            R.tool_id.isnot(None),
            violation_clause,
        )
    )
    high_risk = int(high_risk_q.scalar_one() or 0)

    return {
        "compliance_rate": round(compliance_rate, 1),
        "compliance_rate_trend_pct": round(trend, 1),
        "missed_count": missed,
        "missed_severity": missed_severity_for_count(missed),
        "high_risk_count": high_risk,
        "active_monitors": active_monitors,
        "as_of": now,
    }


def parse_category(value: Optional[str]) -> Optional[ComplianceCategory]:
    if not value:
        return None
    try:
        return ComplianceCategory(value)
    except ValueError:
        return None


def effective_status_sql_filter(status: str, now: datetime):
    """SQL filter matching effective_status values."""
    if status == "ignored":
        return R.ignored.is_(True)
    if status == "completed":
        return and_(R.status == ComplianceRecordStatus.completed, R.ignored.is_(False))
    if status == "pending":
        return and_(
            R.status == ComplianceRecordStatus.pending,
            R.ignored.is_(False),
            R.required_at >= now,
        )
    if status == "overdue":
        return and_(
            R.status == ComplianceRecordStatus.pending,
            R.ignored.is_(False),
            R.required_at < now,
        )
    return None
