"""
Single authoritative resolver: assigned department + role_key → features → RBAC capabilities.

Frontend and routes must consume outputs from here (via access_snapshot / /auth/me), not infer locally.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.features.canonical_catalog import canonical_keys_from_contract, canonicalize_feature_keys
from app.core.permission_feature_matrix import matrix_cell_features
from app.core.rbac.resolve import effective_rbac_permission_keys
from app.core.tenant_feature_access import (
    _department_role_matrix_is_configured,
    _features_from_legacy_role_feature_access,
    _features_from_user_allow_extra,
    _sorted_canonical_union_contract_filtered,
    tenant_full_admin_canonical_features,
)
from app.core.tenant_role_assignments import (
    ActiveTenantAssignment,
    TenantAssignmentResolution,
    resolve_tenant_assignment,
)
from app.core.tenant_roles import effective_features_from_role
from app.core.user_roles import user_has_any_role, user_has_tenant_full_admin
from app.models.domain import User, UserRole
from app.models.rbac_models import TenantRole


@dataclass
class TenantCapabilities:
    status: Literal["assigned", "unassigned", "admin_bypass"]
    department_slug: str | None = None
    role_key: str | None = None
    features: list[str] = field(default_factory=list)
    capabilities: list[str] = field(default_factory=list)
    resolution_trace: list[str] = field(default_factory=list)
    assignment_id: str | None = None


def resolve_tenant_feature_list(
    *,
    user: User,
    contract_names: list[str],
    merged_settings: dict[str, Any],
    tenant_role: TenantRole | None = None,
    assignment: ActiveTenantAssignment | None = None,
) -> tuple[list[str], Literal["assigned", "unassigned"], str | None, str | None]:
    """
    Synchronous feature resolution (assignment-primary).

    Returns ``(features, status, department_slug, role_key)``.
    """
    contract_canonical = canonical_keys_from_contract(contract_names)
    merged = merged_settings or {}

    if tenant_role is not None and tenant_role.slug == "no_access":
        return [], "unassigned", None, None

    extras = _features_from_user_allow_extra(user=user, contract_names=contract_names)

    if assignment is None:
        feats = _sorted_canonical_union_contract_filtered([extras], contract_canonical=contract_canonical)
        return feats, "unassigned", None, None

    matrix = merged.get("department_role_feature_access")
    matrix_feats: list[str] = []
    if _department_role_matrix_is_configured(matrix) and isinstance(matrix, dict):
        raw = matrix_cell_features(matrix, department=assignment.department_slug, slot=assignment.role_key)
        matrix_feats = sorted(set(canonicalize_feature_keys(raw)) & set(contract_canonical))

    overlay_feats: list[str] = []
    if tenant_role is not None and tenant_role.slug != "no_access":
        overlay_raw = effective_features_from_role(tenant_role, contract_names=contract_names)
        if overlay_raw:
            overlay_feats = sorted(set(overlay_raw) & set(matrix_feats))

    feats = _sorted_canonical_union_contract_filtered(
        [matrix_feats, overlay_feats, extras],
        contract_canonical=contract_canonical,
    )
    return feats, "assigned", assignment.department_slug, assignment.role_key


async def resolve_tenant_capabilities(
    db: AsyncSession,
    user: User,
    *,
    contract_names: list[str],
    merged_settings: dict[str, Any],
    tenant_role: TenantRole | None = None,
    assignment: ActiveTenantAssignment | None = None,
) -> TenantCapabilities:
    """
    Authoritative permission resolver for a tenant user.

    - Company / system admin: full contract (backend-only bypass).
    - ``no_access`` overlay: deny all.
    - Active ``tenant_role_assignment``: matrix[department][role_key] ∩ contract.
    - Unassigned: no matrix features (feature_allow_extra only).
    """
    trace: list[str] = ["resolve_tenant_capabilities: start"]
    contract_canonical = canonical_keys_from_contract(contract_names)

    if user.company_id is None or user.is_system_admin or user_has_any_role(user, UserRole.system_admin):
        feats = list(contract_canonical)
        caps = ["*"]
        trace.append("✓ System operator — contract-wide capabilities.")
        return TenantCapabilities(
            status="admin_bypass",
            features=feats,
            capabilities=caps,
            resolution_trace=trace,
        )

    cid = str(user.company_id)

    if user_has_tenant_full_admin(user):
        feats = tenant_full_admin_canonical_features(contract_names)
        trace.append("✓ Tenant full admin — catalog/contract bypass.")
        caps = await effective_rbac_permission_keys(
            db, user, contract_feature_names=contract_names, effective_feature_names=feats
        )
        return TenantCapabilities(
            status="admin_bypass",
            features=feats,
            capabilities=caps,
            resolution_trace=trace,
        )

    if tenant_role is not None and tenant_role.slug == "no_access":
        trace.append("✗ TenantRole overlay slug=no_access — deny all modules.")
        return TenantCapabilities(status="unassigned", resolution_trace=trace)

    active_assignment = assignment
    if active_assignment is not None:
        assignment_res = TenantAssignmentResolution(
            status="assigned",
            assignment=active_assignment,
            trace=[f"assignment injected (id={active_assignment.id})"],
        )
    else:
        assignment_res = await resolve_tenant_assignment(db, company_id=cid, user_id=str(user.id))
    trace.extend(assignment_res.trace)

    if assignment_res.status != "assigned" or not assignment_res.assignment:
        trace.append("✗ Unassigned — no department/role matrix features granted.")
        feats, _, _, _ = resolve_tenant_feature_list(
            user=user,
            contract_names=contract_names,
            merged_settings=merged_settings,
            tenant_role=tenant_role,
            assignment=None,
        )
        if feats:
            trace.append(f"feature_allow_extra only: {feats!r}")
        caps = await effective_rbac_permission_keys(
            db, user, contract_feature_names=contract_names, effective_feature_names=feats
        )
        return TenantCapabilities(
            status="unassigned",
            features=feats,
            capabilities=caps,
            resolution_trace=trace,
        )

    asn = assignment_res.assignment
    feats, _, dept, role = resolve_tenant_feature_list(
        user=user,
        contract_names=contract_names,
        merged_settings=merged_settings,
        tenant_role=tenant_role,
        assignment=asn,
    )
    matrix = merged_settings.get("department_role_feature_access")
    if _department_role_matrix_is_configured(matrix) and isinstance(matrix, dict):
        trace.append(f"✓ Matrix cell {dept!r}/{role!r} resolved → features {feats!r}")
    else:
        trace.append("✗ department_role_feature_access not configured — assigned user receives no matrix modules.")

    caps = await effective_rbac_permission_keys(
        db, user, contract_feature_names=contract_names, effective_feature_names=feats
    )
    trace.append(f"effective features={feats!r}")
    trace.append(f"effective capabilities={caps!r}")

    return TenantCapabilities(
        status="assigned",
        department_slug=dept,
        role_key=role,
        features=feats,
        capabilities=caps,
        resolution_trace=trace,
        assignment_id=asn.id,
    )
