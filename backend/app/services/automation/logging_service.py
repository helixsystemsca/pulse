"""Structured automation observability rows (complements stdlib logging)."""

from __future__ import annotations

from typing import Any, Literal, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.automation_engine import AutomationLog

Severity = Literal["info", "warning", "error"]
SourceModule = Literal["enrichment", "proximity", "ingest", "gateway_arbitration"]


async def log_event(
    db: AsyncSession,
    *,
    company_id: Optional[str],
    log_type: str,
    message: str,
    payload: Optional[dict[str, Any]] = None,
    severity: Severity = "info",
    source_module: SourceModule = "ingest",
) -> AutomationLog:
    row = AutomationLog(
        company_id=company_id,
        type=log_type,
        message=message,
        payload=dict(payload or {}),
        severity=severity,
        source_module=source_module,
    )
    db.add(row)
    await db.flush()
    return row
