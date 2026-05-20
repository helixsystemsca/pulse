"""
Canonical department → baseline matrix slot mapping (organizational model).

Must remain free of imports from ``permission_feature_matrix`` (Alembic loads app
modules during migration discovery; a cycle breaks deploy).
"""

from __future__ import annotations

PERMISSION_MATRIX_DEPARTMENTS: frozenset[str] = frozenset(
    {"maintenance", "communications", "aquatics", "reception", "fitness", "racquets", "admin"}
)

_MATRIX_DEPARTMENTS = PERMISSION_MATRIX_DEPARTMENTS

# Authoritative baseline slot per permission-matrix department.
DEPARTMENT_BASELINE_SLOTS: dict[str, str] = {
    "maintenance": "operations",
    "communications": "coordination",
    "reception": "coordination",
    "aquatics": "aquatics_staff",
    "fitness": "fitness_staff",
    "racquets": "racquets_staff",
    "admin": "admin_staff",
}

# Sentinel when resolver cannot determine a valid department baseline.
UNRESOLVED_MATRIX_SLOT = "unresolved"

# Legacy compatibility row — not used as operational baseline.
LEGACY_TEAM_MEMBER_SLOT = "team_member"

OPERATIONAL_MATRIX_SLOT_LABELS: dict[str, str] = {
    "manager": "Manager",
    "coordination": "Coordination",
    "supervisor": "Supervisor",
    "lead": "Lead",
    "operations": "Operations",
    "aquatics_staff": "Aquatics Staff",
    "fitness_staff": "Fitness Staff",
    "racquets_staff": "Racquets Staff",
    "admin_staff": "Admin Staff",
    LEGACY_TEAM_MEMBER_SLOT: "Staff",
    UNRESOLVED_MATRIX_SLOT: "Unresolved",
}


def department_baseline_slot(department: str) -> str | None:
    """Baseline matrix row for a normalized permission-matrix department."""
    return DEPARTMENT_BASELINE_SLOTS.get(department)


def operational_matrix_slot_label(slot: str, *, department: str | None = None) -> str:
    """Human operational label — not internal matrix terminology."""
    if slot in OPERATIONAL_MATRIX_SLOT_LABELS:
        return OPERATIONAL_MATRIX_SLOT_LABELS[slot]
    return slot.replace("_", " ").title()


def all_baseline_slots() -> frozenset[str]:
    return frozenset(DEPARTMENT_BASELINE_SLOTS.values())


def departments_missing_baseline() -> list[str]:
    return sorted(d for d in _MATRIX_DEPARTMENTS if d not in DEPARTMENT_BASELINE_SLOTS)
