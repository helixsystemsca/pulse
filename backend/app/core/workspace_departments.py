"""Legacy helpers for normalizing HR department slug lists (workspace auth removed)."""

from __future__ import annotations

from typing import Sequence

from app.models.domain import User
from app.models.pulse_models import PulseWorkerHR

ALLOWED_WORKSPACE_DEPARTMENT_SLUGS: frozenset[str] = frozenset(
    {"maintenance", "reception", "communications", "aquatics", "fitness", "racquets", "admin"}
)


def normalize_workspace_department_slug(raw: str | None) -> str | None:
    if not raw:
        return None
    s = str(raw).strip().lower()
    return s if s in ALLOWED_WORKSPACE_DEPARTMENT_SLUGS else None


def normalize_workspace_department_slug_list(values: Sequence[str] | None) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for x in values or []:
        n = normalize_workspace_department_slug(str(x))
        if n and n not in seen:
            seen.add(n)
            out.append(n)
    return out


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
