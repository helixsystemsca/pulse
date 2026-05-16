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
    _features_from_user_allow_extra,
    _sorted_canonical_union_contract_filtered,
    tenant_full_admin_canonical_features,
)
from app.core.tenant_role_assignments import (
    ActiveTenantAssignment,
    TenantAssignmentResolution,
    resolve_tenant_assignment,
)
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
    - Unassigned: no matrix features (onboarding-limited).
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

    if assignment is not None:
        assignment_res = TenantAssignmentResolution(
            status="assigned",
            assignment=assignment,
            trace=[f"assignment injected (id={assignment.id})"],
        )
    else:
        assignment_res = await resolve_tenant_assignment(db, company_id=cid, user_id=str(user.id))
    trace.extend(assignment_res.trace)

    if assignment_res.status != "assigned" or not assignment_res.assignment:
        trace.append("✗ Unassigned — no department/role matrix features granted.")
        extras = _features_from_user_allow_extra(user=user, contract_names=contract_names)
        feats = _sorted_canonical_union_contract_filtered([[]], contract_canonical=contract_canonical)
        if extras:
            trace.append(f"feature_allow_extra only: {extras!r}")
            feats = _sorted_canonical_union_contract_filtered([extras], contract_canonical=contract_canonical)
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
    matrix = merged_settings.get("department_role_feature_access")
    matrix_feats: list[str] = []
    if _department_role_matrix_is_configured(matrix) and isinstance(matrix, dict):
        raw = matrix_cell_features(matrix, department=asn.department_slug, slot=asn.role_key)
        matrix_feats = sorted(
            set(canonicalize_feature_keys(raw)) & set(contract_canonical)
        )
        trace.append(
            f"✓ Matrix cell {asn.department_slug!r}/{asn.role_key!r} → {matrix_feats!r} (∩ contract)"
        )
    else:
        trace.append("✗ department_role_feature_access not configured — assigned user receives no matrix modules.")

    extras = _features_from_user_allow_extra(user=user, contract_names=contract_names)
    feats = _sorted_canonical_union_contract_filtered(
        [matrix_feats, extras],
        contract_canonical=contract_canonical,
    )
    caps = await effective_rbac_permission_keys(
        db, user, contract_feature_names=contract_names, effective_feature_names=feats
    )
    trace.append(f"effective features={feats!r}")
    trace.append(f"effective capabilities={caps!r}")

    return TenantCapabilities(
        status="assigned",
        department_slug=asn.department_slug,
        role_key=asn.role_key,
        features=feats,
        capabilities=caps,
        resolution_trace=trace,
        assignment_id=asn.id,
    )
