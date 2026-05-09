"""Multi-role helpers for tenant users (`users.roles` PostgreSQL array)."""

from __future__ import annotations

from typing import Iterable, Sequence

from app.models.domain import OperationalRole, User, UserRole

# Highest precedence first (used for JWT `role` claim and primary display).
_ROLE_PRECEDENCE: tuple[UserRole, ...] = (
    UserRole.system_admin,
    UserRole.company_admin,
    UserRole.manager,
    UserRole.supervisor,
    UserRole.lead,
    UserRole.worker,
    UserRole.demo_viewer,
)

_PRECEDENCE_INDEX = {r: i for i, r in enumerate(_ROLE_PRECEDENCE)}

# Facility-facing roles (excludes company_admin / system_admin) for display + operational defaults.
_FACILITY_STAFF_PRECEDENCE: tuple[UserRole, ...] = (
    UserRole.manager,
    UserRole.supervisor,
    UserRole.lead,
    UserRole.worker,
)
_FACILITY_STAFF_INDEX = {r: i for i, r in enumerate(_FACILITY_STAFF_PRECEDENCE)}

# Tenant roles that may appear together on one user (system_admin is separate / platform).
TENANT_ROLE_VALUES: frozenset[str] = frozenset(
    {
        UserRole.company_admin.value,
        UserRole.manager.value,
        UserRole.supervisor.value,
        UserRole.lead.value,
        UserRole.worker.value,
        UserRole.demo_viewer.value,
    }
)

def normalize_role_strings(raw: Sequence[str]) -> list[str]:
    """Trim, validate against UserRole, dedupe while preserving precedence order."""
    seen: set[str] = set()
    out: list[str] = []
    for s in raw:
        v = str(s).strip()
        if not v or v in seen:
            continue
        UserRole(v)  # validate
        seen.add(v)
        out.append(v)
    return out


def validate_tenant_roles_non_empty(roles: list[str]) -> list[str]:
    r = normalize_role_strings(roles)
    if not r:
        raise ValueError("roles must include at least one role")
    extra = set(r) - TENANT_ROLE_VALUES
    if extra:
        raise ValueError(f"invalid tenant role(s): {', '.join(sorted(extra))}")
    return r


def user_roles_enum(user: User) -> list[UserRole]:
    return [UserRole(r) for r in user.roles]


def user_has_any_role(user: User, *roles: UserRole) -> bool:
    want = {r.value for r in roles}
    return bool(want.intersection(user.roles))


def user_roles_subset_of(user: User, allowed: Iterable[UserRole]) -> bool:
    allow = {r.value for r in allowed}
    return set(user.roles).issubset(allow)


def user_has_facility_tenant_admin_flag(user: User) -> bool:
    """True when sysadmin designated this user as an in-facility tenant admin (separate from `company_admin` role)."""
    return bool(getattr(user, "facility_tenant_admin", False))


def user_is_external_company_admin(user: User) -> bool:
    """IT / off-site style tenant admin: `company_admin` appears in `users.roles`."""
    return user_has_any_role(user, UserRole.company_admin)


def user_has_tenant_full_admin(user: User) -> bool:
    """Full tenant administration: external `company_admin` role OR in-facility delegate flag."""
    if user_is_external_company_admin(user):
        return True
    return user_has_facility_tenant_admin_flag(user)


def primary_facility_staff_role(user: User) -> UserRole:
    """Highest facility role among worker/lead/supervisor/manager (ignores company_admin / system_admin)."""
    best: UserRole = UserRole.worker
    best_i = 10**9
    for r in user_roles_enum(user):
        if r not in _FACILITY_STAFF_INDEX:
            continue
        i = _FACILITY_STAFF_INDEX[r]
        if i < best_i:
            best_i = i
            best = r
    return best


_FACILITY_ROLE_LABEL: dict[UserRole, str] = {
    UserRole.worker: "Operations",
    UserRole.lead: "Lead",
    UserRole.supervisor: "Supervisor",
    UserRole.manager: "Manager",
}


def tenant_role_display_label(user: User) -> str | None:
    """Sidebar / profile label override, e.g. ``Operations (Admin)``. ``None`` = use primary JWT role + client humanize."""
    if user_is_external_company_admin(user):
        return None
    if user_has_facility_tenant_admin_flag(user):
        base = primary_facility_staff_role(user)
        return f"{_FACILITY_ROLE_LABEL.get(base, base.value)} (Admin)"
    return None


def primary_jwt_role(user: User) -> UserRole:
    """Single claim for backward-compatible JWT + sorting."""
    best: UserRole | None = None
    best_i = 10**9
    for r in user_roles_enum(user):
        i = _PRECEDENCE_INDEX.get(r, 999)
        if i < best_i:
            best_i = i
            best = r
    return best if best is not None else UserRole.worker


def roles_match_token(db_roles: list[str], token_roles: list[str] | None, token_primary: str) -> bool:
    """Validate JWT against DB (sorted compare). Legacy tokens carry only `role`."""
    left = sorted(str(r) for r in db_roles)
    if token_roles is None:
        right = sorted([token_primary])
    else:
        right = sorted(str(r) for r in token_roles)
    return left == right


# Alias for readability
def user_roles_values(user: User) -> list[str]:
    return list(user.roles)


def is_elevated_tenant_staff(user: User) -> bool:
    """Managers, supervisors, tenant admins (external or in-facility delegate), and platform/system admins."""
    if user.is_system_admin:
        return True
    if user_has_facility_tenant_admin_flag(user):
        return True
    return user_has_any_role(
        user,
        UserRole.system_admin,
        UserRole.company_admin,
        UserRole.manager,
        UserRole.supervisor,
    )


def default_operational_role_for_invite_role(role: UserRole) -> str | None:
    """Initial workforce enrollment when inviting/creating a user from a permission role."""
    if role in (UserRole.worker, UserRole.lead):
        return OperationalRole.worker.value
    if role == UserRole.supervisor:
        return OperationalRole.supervisor.value
    if role in (UserRole.manager, UserRole.company_admin):
        return OperationalRole.manager.value
    return None


def user_participates_in_workforce_operations(user: User) -> bool:
    """True when the user is included in scheduling, pulse roster, and proximity workforce monitoring."""
    v = (user.operational_role or "").strip()
    if not v:
        return False
    try:
        OperationalRole(v)
    except ValueError:
        return False
    return True


def is_field_worker_like(user: User) -> bool:
    """
    Workers/leads without manager+ privileges (worker+manager uses manager workflows,
    not field-worker-only restrictions).
    """
    if not user_has_any_role(user, UserRole.worker, UserRole.lead):
        return False
    return not is_elevated_tenant_staff(user)

