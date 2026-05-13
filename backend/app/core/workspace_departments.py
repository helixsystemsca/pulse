"""Department workspace slugs (URL segments under `/{slug}/…`) — HR + auth."""

from __future__ import annotations

from typing import Sequence

from app.core.user_roles import user_has_any_role
from app.models.domain import User, UserRole
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
    """Slugs the user may open under `/{slug}/…` (intersect with platform registry on the client)."""
    if not user.company_id:
        return []
    if user.is_system_admin or user_has_any_role(user, UserRole.system_admin):
        return sorted(ALLOWED_WORKSPACE_DEPARTMENT_SLUGS)

    perms = list(permissions or [])
    if "*" in perms:
        return sorted(ALLOWED_WORKSPACE_DEPARTMENT_SLUGS)
    if user_has_any_role(user, UserRole.company_admin, UserRole.manager, UserRole.supervisor) or bool(
        getattr(user, "facility_tenant_admin", False)
    ):
        return sorted(ALLOWED_WORKSPACE_DEPARTMENT_SLUGS)

    slugs: list[str] = []
    raw = getattr(hr, "department_slugs", None) if hr else None
    if isinstance(raw, list):
        slugs = normalize_workspace_department_slug_list([str(x) for x in raw])
    if not slugs and hr and hr.department:
        one = normalize_workspace_department_slug(hr.department)
        if one:
            slugs = [one]
    return sorted(set(slugs))
