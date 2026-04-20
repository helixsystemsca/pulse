"""Who earns XP and which role track applies."""

from __future__ import annotations

from app.core.user_roles import user_has_any_role
from app.models.domain import User, UserRole


def is_xp_excluded_admin(user: User) -> bool:
    """Company/platform managers do not participate in field XP ladders."""
    if getattr(user, "is_system_admin", False):
        return True
    return user_has_any_role(
        user,
        UserRole.system_admin,
        UserRole.company_admin,
        UserRole.manager,
    )


def user_may_earn_track(user: User, track: str) -> bool:
    if is_xp_excluded_admin(user):
        return False
    t = str(track).strip().lower()
    if t == "worker":
        return True
    if t == "lead":
        return user_has_any_role(user, UserRole.lead)
    if t == "supervisor":
        return user_has_any_role(user, UserRole.supervisor)
    return False


def assigner_operational_track(user: User) -> str | None:
    """For assignment-style XP: supervisor bucket wins over lead."""
    if is_xp_excluded_admin(user):
        return None
    if user_has_any_role(user, UserRole.supervisor):
        return "supervisor"
    if user_has_any_role(user, UserRole.lead):
        return "lead"
    return None


def task_completion_role_multiplier(user: User) -> float:
    """Leads/supervisors who are not also workers earn reduced task-completion XP."""
    if is_xp_excluded_admin(user):
        return 0.0
    has_worker = user_has_any_role(user, UserRole.worker)
    if has_worker:
        return 1.0
    if user_has_any_role(user, UserRole.lead):
        return 0.4
    if user_has_any_role(user, UserRole.supervisor):
        return 0.25
    return 1.0
