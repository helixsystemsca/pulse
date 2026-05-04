"""Pure metric calculations and mock KPI snapshots (no I/O)."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass


def project_seed_int(project_ref: str | int) -> int:
    """Stable positive int derived from a project id (UUID string or legacy int seed)."""
    if isinstance(project_ref, int):
        return abs(project_ref) % 2_147_483_647
    digest = hashlib.sha256(str(project_ref).encode("utf-8")).digest()[:8]
    return int.from_bytes(digest, "big") % 2_147_483_647


def calculate_schedule_variance(planned_days: int, actual_days: int) -> int:
    """Calendar slip in days: positive means actual duration exceeded plan."""
    return int(actual_days) - int(planned_days)


def calculate_completion_rate(planned_tasks: int, completed_tasks: int) -> float:
    """Share of planned work completed, as a percentage in ``[0.0, 100.0]``."""
    if planned_tasks <= 0:
        return 0.0
    ratio = min(1.0, max(0.0, completed_tasks / planned_tasks))
    return round(100.0 * ratio, 2)


def calculate_inspection_pass_rate(passed: int, failed: int) -> float:
    """Passed inspections as a percentage of all completed inspections."""
    total = passed + failed
    if total <= 0:
        return 0.0
    return round(100.0 * passed / total, 2)


@dataclass(frozen=True)
class MockProjectMetrics:
    """Placeholder KPIs keyed by project; replace with real sources later."""

    project_id: int
    phase_label: str
    completion_pct: int
    open_risk_count: int
    stakeholder_count: int


def mock_metrics_for_project(project_id: int) -> MockProjectMetrics:
    """Deterministic mock metrics derived from ``project_id`` only."""
    completion = min(95, 40 + (project_id % 7) * 8)
    return MockProjectMetrics(
        project_id=project_id,
        phase_label="Execution" if completion > 55 else "Planning",
        completion_pct=completion,
        open_risk_count=1 + (project_id % 4),
        stakeholder_count=3 + (project_id % 5),
    )
