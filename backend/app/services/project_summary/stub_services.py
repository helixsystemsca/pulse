"""Placeholder service singletons for summary aggregators (no DB).

Replace module-level instances with real implementations when wiring persistence.
"""

from __future__ import annotations

import hashlib
from datetime import date, timedelta
from typing import Any, Optional

from app.services.project_summary.metrics import project_seed_int


class TaskServiceStub:
    """Stand-in for project task / PM task APIs."""

    def get_tasks_by_project(self, project_id: str | int) -> list[dict[str, Any]]:
        """Raw task rows: enough for scope, schedule, and resource rollups."""
        pid = project_seed_int(project_id)
        n = 8 + (pid % 7)
        base = date(2025, 1, 1) + timedelta(days=pid % 90)
        tasks: list[dict[str, Any]] = []
        for i in range(n):
            state = "completed" if i < n - 2 - (pid % 3) else ("delayed" if i % 4 == 0 else "open")
            assignee = f"user-{(pid + i) % 4}"
            due = base + timedelta(days=5 * (i + 1))
            finished: Optional[date] = None
            if state == "completed":
                finished = due - timedelta(days=1 if i % 2 == 0 else -2)
            elif state == "delayed":
                finished = None
            scope_note = f"CR-{pid}-{i}" if i == 1 and pid % 3 == 0 else None
            tasks.append(
                {
                    "task_id": f"tsk-{pid}-{i}",
                    "state": state,
                    "assignee_id": assignee,
                    "baseline_end": due,
                    "finished_at": finished,
                    "scope_change_note": scope_note,
                }
            )
        return tasks


class LogServiceStub:
    """Stand-in for activity / comms / time logs."""

    def get_communication_rollups(self, project_id: str | int) -> dict[str, Any]:
        pid = project_seed_int(project_id)
        return {
            "update_count": 15 + (pid % 18),
            "avg_response_time_hours": 3.2 + (pid % 5) if pid % 4 != 0 else None,
        }

    def get_hours_logged_by_user(self, project_id: str | int) -> dict[str, float]:
        seed = project_seed_int(project_id)
        users = [f"user-{i}" for i in range(4)]
        out: dict[str, float] = {}
        for u in users:
            h = int(hashlib.sha256(f"{seed}:{u}".encode()).hexdigest()[:6], 16)
            out[u] = float(20 + h % 40)
        return out


class InspectionServiceStub:
    """Stand-in for inspection / QA APIs."""

    def get_inspection_rollups(self, project_id: str | int) -> dict[str, Any]:
        pid = project_seed_int(project_id)
        failed = pid % 4
        return {
            "passed": 10 + (pid % 6),
            "failed": failed,
            "rework_events": failed + (pid % 2),
        }


task_service = TaskServiceStub()
log_service = LogServiceStub()
inspection_service = InspectionServiceStub()
