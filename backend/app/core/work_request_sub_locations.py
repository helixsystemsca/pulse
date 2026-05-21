"""Facility sub-areas for work request intake analytics."""

from typing import Optional

WORK_REQUEST_SUB_LOCATIONS: tuple[str, ...] = (
    "Arena",
    "Pool",
    "Weightroom",
    "Fitness Studio",
    "Racquet",
    "Grounds",
    "Admin",
)


def normalize_sub_location(raw: Optional[str]) -> Optional[str]:
    if raw is None:
        return None
    t = raw.strip()
    if not t:
        return None
    for label in WORK_REQUEST_SUB_LOCATIONS:
        if label.lower() == t.lower():
            return label
    return None
