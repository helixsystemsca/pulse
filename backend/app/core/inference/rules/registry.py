"""Central list of inference rule instances — add modules here without touching the orchestrator."""

from __future__ import annotations

from typing import List

from app.core.inference.rules.maintenance_schedule_due import MaintenanceScheduleDueRule
from app.core.inference.rules.missing_tool_signal import MissingToolSignalRule
from app.core.inference.rules.zone_entry_assignment import ZoneEntryAssignmentRule


def load_builtin_rules() -> List[object]:
    """
    Return new instances for each registered rule.

    Third-party rules: append your own class instances here or replace this function via
    dependency injection in tests.
    """
    return [
        ZoneEntryAssignmentRule(),
        MissingToolSignalRule(),
        MaintenanceScheduleDueRule(),
    ]
