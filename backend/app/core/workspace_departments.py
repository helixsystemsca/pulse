"""Legacy helpers for normalizing HR department slug lists (workspace auth removed)."""

from __future__ import annotations

from typing import Sequence

from app.core.tenant_departments import normalize_department_slug_format, normalize_department_slug_list
from app.models.domain import User
from app.models.pulse_models import PulseWorkerHR


def normalize_workspace_department_slug(raw: str | None) -> str | None:
    return normalize_department_slug_format(raw)


def normalize_workspace_department_slug_list(values: Sequence[str] | None) -> list[str]:
    return normalize_department_slug_list(values)


def effective_workspace_slugs_for_user(
    *,
    user: User,
    hr: PulseWorkerHR | None,
    permissions: Sequence[str] | None,
) -> list[str]:
    """
    Deprecated for authorization: `/auth/me` no longer uses this list for UI or route access.

    Department hubs (`/{slug}/…`) are gated only by tenant RBAC + contract modules on the client.
    Kept returning an empty list so API shape stays stable; do not use for access decisions.
    """
    return []


def primary_hr_department_slug_for_auth(hr: PulseWorkerHR | None) -> str | None:
    """Primary HR department slug for shell / profile display on `/auth/me` (not used for authorization)."""
    if not hr:
        return None
    one = normalize_workspace_department_slug((hr.department or "").strip() or None)
    if one:
        return one
    raw = getattr(hr, "department_slugs", None)
    if isinstance(raw, list):
        for x in raw:
            n = normalize_workspace_department_slug(str(x))
            if n:
                return n
    return None
