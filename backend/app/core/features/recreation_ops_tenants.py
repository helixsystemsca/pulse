"""Hardcoded Recreation Ops enablement for City of Vernon (Josh).

System admin can still toggle `recreation_ops` for any other tenant.
Vernon is always on: company name match, or the named company admin email.
"""

from __future__ import annotations

VERNON_COMPANY_NAME_MARKERS: tuple[str, ...] = ("city of vernon",)
VERNON_ADMIN_EMAILS: frozenset[str] = frozenset({"josh@vernon.ca"})
RECREATION_OPS_FEATURE = "recreation_ops"
DAILY_PLANNER_FEATURE = "daily_planner"
VERNON_PINNED_FEATURES: tuple[str, ...] = (RECREATION_OPS_FEATURE, DAILY_PLANNER_FEATURE)
#: Same-origin static file served by the Pulse SPA (`frontend/public/images/city-of-vernon-logo.png`).
VERNON_DEFAULT_LOGO_URL = "/images/city-of-vernon-logo.png"


def recreation_ops_forced_for_company_name(name: str | None) -> bool:
    n = (name or "").strip().lower()
    if not n:
        return False
    return any(marker in n for marker in VERNON_COMPANY_NAME_MARKERS)


def recreation_ops_forced_for_email(email: str | None) -> bool:
    return (email or "").strip().lower() in VERNON_ADMIN_EMAILS


def apply_vernon_default_logo(company: object) -> bool:
    """Seed the City of Vernon static mark when the tenant has no logo yet.

    Does not replace an uploaded file (`logo_storage_key`) or a custom `logo_url`.
    Returns True when `logo_url` was written.
    """
    if not recreation_ops_forced_for_company_name(getattr(company, "name", None)):
        return False
    storage_key = (getattr(company, "logo_storage_key", None) or "").strip()
    if storage_key:
        return False
    existing = (getattr(company, "logo_url", None) or "").strip()
    if existing:
        return False
    setattr(company, "logo_url", VERNON_DEFAULT_LOGO_URL)
    return True
