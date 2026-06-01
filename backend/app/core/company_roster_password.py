"""Tenant default password for roster-only / admin-provisioned employee accounts."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.domain import Company

LEGACY_DEFAULT_ROSTER_PASSWORD = "Panorama"


def roster_password_for_company(company: Company | None) -> str:
    raw = (getattr(company, "default_roster_password", None) or "").strip()
    return raw or LEGACY_DEFAULT_ROSTER_PASSWORD
