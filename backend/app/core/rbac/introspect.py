"""Assemble a deterministic RBAC introspection payload for admins (debug / support)."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac.catalog import FEATURE_TO_RBAC_PERMISSIONS
from app.core.rbac.registry import ALL_KNOWN_RBAC_KEYS, PERMISSION_REGISTRY
from app.core.rbac.resolve import (
    _filter_keys_by_contract,
    effective_rbac_permission_keys,
    rbac_keys_from_legacy_effective_features,
)
from app.core.tenant_feature_access import contract_and_effective_features_for_me
from app.core.user_roles import user_has_any_role, user_has_tenant_full_admin
from app.models.domain import User, UserRole
from app.models.rbac_models import TenantRoleGrant


def _catalog_payload() -> tuple[list[dict], dict[str, list[str]]]:
    catalog = [
        {
            "key": rec.key,
            "description": rec.description,
            "requires_company_feature": rec.requires_company_feature,
        }
        for rec in PERMISSION_REGISTRY.values()
    ]
    bridge = {k: list(v) for k, v in FEATURE_TO_RBAC_PERMISSIONS.items()}
    return catalog, bridge


def _contract_set(names: list[str]) -> set[str]:
    return {str(x) for x in names if x}


async def build_rbac_introspection(db: AsyncSession, user: User) -> dict:
    roles = list(user.roles or [])
    extras_raw = getattr(user, "feature_allow_extra", None) or []
    extras = [str(x) for x in extras_raw if isinstance(x, str)]

    if user.is_system_admin or user_has_any_role(user, UserRole.system_admin):
        return {
            "user_id": str(user.id),
            "company_id": None,
            "jwt_roles": roles,
            "tenant_role_id": getattr(user, "tenant_role_id", None),
            "contract_features": [],
            "matrix_effective_features": [],
            "feature_allow_extra": extras,
            "effective_rbac_keys": ["*"],
            "denied_catalog_keys": [],
            "resolution_summary": "system_administrator",
            "workers_roster_delegation": False,
            "permission_sources": [{"key": "*", "sources": ["system_administrator"]}],
            "feature_to_rbac_bridge": _catalog_payload()[1],
            "catalog": _catalog_payload()[0],
        }

    if user.company_id is None:
        return {
            "user_id": str(user.id),
            "company_id": None,
            "jwt_roles": roles,
            "tenant_role_id": getattr(user, "tenant_role_id", None),
            "contract_features": [],
            "matrix_effective_features": [],
            "feature_allow_extra": extras,
            "effective_rbac_keys": [],
            "denied_catalog_keys": sorted(ALL_KNOWN_RBAC_KEYS),
            "resolution_summary": "no_company",
            "workers_roster_delegation": False,
            "permission_sources": [],
            "feature_to_rbac_bridge": _catalog_payload()[1],
            "catalog": _catalog_payload()[0],
        }

    cid = str(user.company_id)
    contract, eff_matrix, roster, _admin_catalog = await contract_and_effective_features_for_me(db, user)

    resolved = await effective_rbac_permission_keys(
        db,
        user,
        contract_feature_names=contract,
        effective_feature_names=eff_matrix,
    )
    resolved_set = set(resolved)
    cset = _contract_set(contract)

    if user_has_tenant_full_admin(user):
        denied = [] if "*" in resolved_set else sorted(ALL_KNOWN_RBAC_KEYS - resolved_set)
        summary = "tenant_full_admin"
        sources_rows = (
            [{"key": "*", "sources": ["tenant_full_admin"]}]
            if "*" in resolved_set
            else [{"key": k, "sources": ["tenant_full_admin_contract"]} for k in sorted(resolved_set)]
        )
    else:
        tr_id = getattr(user, "tenant_role_id", None)
        if tr_id:
            q = await db.execute(
                select(TenantRoleGrant.permission_key).where(TenantRoleGrant.tenant_role_id == str(tr_id))
            )
            raw_grants = {str(r[0]) for r in q.all()}
            grant_keys = _filter_keys_by_contract(raw_grants, cset)
            denied = sorted(ALL_KNOWN_RBAC_KEYS - resolved_set)
            summary = "tenant_custom_role_grants"
            sources_rows = []
            for k in sorted(resolved_set):
                src = ["tenant_role_grant"] if k in grant_keys else ["tenant_role_grant_contract_filtered"]
                sources_rows.append({"key": k, "sources": src})
        else:
            denied = sorted(ALL_KNOWN_RBAC_KEYS - resolved_set)
            summary = "matrix_feature_bridge_with_optional_extras"
            m_keys = _filter_keys_by_contract(rbac_keys_from_legacy_effective_features(eff_matrix), cset)
            extra_mods = [e for e in extras if e in cset]
            x_keys = _filter_keys_by_contract(rbac_keys_from_legacy_effective_features(extra_mods), cset)
            sources_rows = []
            for k in sorted(resolved_set):
                src: list[str] = []
                if k in m_keys:
                    src.append("permission_matrix")
                if k in x_keys:
                    src.append("feature_allow_extra")
                if not src:
                    src.append("contract_filtered_bridge")
                sources_rows.append({"key": k, "sources": src})

    catalog_meta, bridge = _catalog_payload()

    return {
        "user_id": str(user.id),
        "company_id": cid,
        "jwt_roles": roles,
        "tenant_role_id": getattr(user, "tenant_role_id", None),
        "contract_features": contract,
        "matrix_effective_features": eff_matrix,
        "feature_allow_extra": extras,
        "effective_rbac_keys": sorted(resolved_set),
        "denied_catalog_keys": denied,
        "resolution_summary": summary,
        "workers_roster_delegation": roster,
        "permission_sources": sources_rows,
        "feature_to_rbac_bridge": bridge,
        "catalog": catalog_meta,
    }
