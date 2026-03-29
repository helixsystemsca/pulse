"""Per-evaluation context passed into inference rules (clock, DB, thresholds)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession


@dataclass
class InferenceContext:
    """
    Snapshot for one orchestration pass — keeps time-based rules testable and consistent.

    Rules must not assume a global clock; always use ``ctx.now``.
    """

    db: AsyncSession
    now: datetime
    global_min_confidence: float
