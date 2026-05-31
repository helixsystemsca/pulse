"""Dedicated kiosk / equipment roster accounts (e.g. inventory scanner tablet login)."""

from __future__ import annotations

EQUIPMENT_ROSTER_DEPARTMENT = "equipment"

# Tenant role slugs that identify non-human kiosk accounts on the permissions roster.
EQUIPMENT_TENANT_ROLE_SLUGS: frozenset[str] = frozenset({"inventory_scanner"})


def is_equipment_roster_account(
    *,
    hr_department: str | None,
    tenant_role_slug: str | None = None,
    assigned_role_key: str | None = None,
) -> bool:
    if (hr_department or "").strip().lower() == EQUIPMENT_ROSTER_DEPARTMENT:
        return True
    slug = (tenant_role_slug or "").strip().lower()
    if slug in EQUIPMENT_TENANT_ROLE_SLUGS:
        return True
    role_key = (assigned_role_key or "").strip().lower()
    return role_key in EQUIPMENT_TENANT_ROLE_SLUGS
