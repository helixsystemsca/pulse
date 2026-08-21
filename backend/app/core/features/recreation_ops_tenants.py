"""Hardcoded Recreation Ops enablement for City of Vernon (Josh).

System admin can still toggle `recreation_ops` for any other tenant.
Vernon is always on: company name match, or the named company admin email.
"""

from __future__ import annotations

VERNON_COMPANY_NAME_MARKERS: tuple[str, ...] = ("city of vernon",)
VERNON_ADMIN_EMAILS: frozenset[str] = frozenset({"josh@vernon.ca"})
RECREATION_OPS_FEATURE = "recreation_ops"


def recreation_ops_forced_for_company_name(name: str | None) -> bool:
    n = (name or "").strip().lower()
    if not n:
        return False
    return any(marker in n for marker in VERNON_COMPANY_NAME_MARKERS)


def recreation_ops_forced_for_email(email: str | None) -> bool:
    return (email or "").strip().lower() in VERNON_ADMIN_EMAILS
