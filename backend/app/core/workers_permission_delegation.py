"""Team Management permission trickle-down: who may edit `role_feature_access` / worker extras."""

from __future__ import annotations

from typing import Any

from app.core.user_roles import UserRole, user_has_any_role, user_has_tenant_full_admin, user_roles_subset_of
from app.models.domain import User


def _pd(merged: dict[str, Any]) -> dict[str, Any]:
    raw = merged.get("permission_delegation")
    return raw if isinstance(raw, dict) else {}


def roles_allowed_to_delegate(actor: User, merged: dict[str, Any]) -> list[str]:
    """Operational roles the actor holds that the company admin has enabled for downstream permission edits."""
    pd = _pd(merged)
    out: list[str] = []
    if user_has_any_role(actor, UserRole.manager) and pd.get("manager"):
        out.append("manager")
    if user_has_any_role(actor, UserRole.supervisor) and pd.get("supervisor"):
        out.append("supervisor")
    if user_has_any_role(actor, UserRole.lead) and pd.get("lead"):
        out.append("lead")
    return out


def delegated_role_feature_targets(actor: User, merged: dict[str, Any]) -> frozenset[str]:
    """`role_feature_access` keys this actor may edit (subordinate roles only)."""
    targets: set[str] = set()
    if user_has_any_role(actor, UserRole.manager) and _pd(merged).get("manager"):
        targets.update(("supervisor", "lead", "worker"))
    if user_has_any_role(actor, UserRole.supervisor) and _pd(merged).get("supervisor"):
        targets.update(("lead", "worker"))
    if user_has_any_role(actor, UserRole.lead) and _pd(merged).get("lead"):
        targets.add("worker")
    return frozenset(targets)


def actor_is_delegated_permission_editor(actor: User, merged: dict[str, Any]) -> bool:
    return bool(roles_allowed_to_delegate(actor, merged))


def delegates_can_assign_worker_module_extras(merged: dict[str, Any]) -> bool:
    return bool(merged.get("delegates_can_assign_worker_module_extras"))


def actor_may_set_worker_feature_allow_extra(actor: User, target: User, merged: dict[str, Any]) -> bool:
    if user_has_tenant_full_admin(actor) or user_has_any_role(actor, UserRole.system_admin) or actor.is_system_admin:
        return True
    if not delegates_can_assign_worker_module_extras(merged):
        return False
    if not actor_is_delegated_permission_editor(actor, merged):
        return False
    if not user_has_any_role(actor, UserRole.manager, UserRole.supervisor, UserRole.lead):
        return False
    # Per-user extras: worker-role principals only (not mixed lead/supervisor stacks).
    if not user_roles_subset_of(target, (UserRole.worker,)):
        return False
    return True
