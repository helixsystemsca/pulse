"""
Deterministic observability for product feature resolution (matrix, extras, RBAC bridge).

Delegates to production resolvers (`effective_tenant_feature_names_for_user`,
`effective_rbac_permission_keys`, matrix helpers); does not implement parallel rules.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permission_feature_matrix import (
    permission_matrix_department_for_user,
    permission_matrix_slot_for_user,
)
from app.core.features.canonical_catalog import (
    CANONICAL_PRODUCT_FEATURES,
    canonical_keys_from_contract,
    canonicalize_feature_keys,
    to_canonical_feature_key,
)
from app.core.features.system_catalog import GLOBAL_SYSTEM_FEATURES
from app.core.rbac.catalog import FEATURE_TO_RBAC_PERMISSIONS
from app.core.rbac.resolve import effective_rbac_permission_keys, rbac_keys_from_legacy_effective_features
from app.core.tenant_feature_access import (
    _department_role_matrix_is_configured,
    _features_from_department_role_matrix,
    _features_from_legacy_role_feature_access,
    _features_from_user_allow_extra,
    effective_tenant_feature_names_for_user,
)
from app.core.tenant_roles import effective_features_from_role
from app.core.user_roles import user_has_any_role, user_has_tenant_full_admin
from app.models.domain import User, UserRole
from app.models.pulse_models import PulseWorkerHR
from app.models.rbac_models import TenantRole


def _raw_matrix_cell_feats(merged: dict[str, Any], dept: str, slot: str) -> list[str]:
    matrix = merged.get("department_role_feature_access") or {}
    if not isinstance(matrix, dict):
        return []
    row = matrix.get(dept)
    if not isinstance(row, dict):
        return []
    raw = row.get(slot)
    if not isinstance(raw, list):
        return []
    return [str(x) for x in raw]


def _all_matrix_cell_canon_keys(merged: dict[str, Any]) -> set[str]:
    matrix = merged.get("department_role_feature_access") or {}
    if not isinstance(matrix, dict):
        return set()
    out: set[str] = set()
    for row in matrix.values():
        if not isinstance(row, dict):
            continue
        for raw in row.values():
            if isinstance(raw, list):
                out.update(canonicalize_feature_keys(raw))
    return out


def _matrix_slots_with_feature(merged: dict[str, Any], dept: str, feature: str) -> list[str]:
    matrix = merged.get("department_role_feature_access") or {}
    if not isinstance(matrix, dict):
        return []
    row = matrix.get(dept)
    if not isinstance(row, dict):
        return []
    slots: list[str] = []
    for slot, raw in row.items():
        if not isinstance(raw, list):
            continue
        if feature in canonicalize_feature_keys(raw):
            slots.append(str(slot))
    return slots


def _candidate_feature_universe(
    *,
    contract_canon: list[str],
    merged_settings: dict[str, Any],
    raw_cell: list[str],
    matrix_feats: list[str],
    overlay: list[str],
    extras: list[str],
    legacy_feats: list[str],
) -> list[str]:
    keys: set[str] = set(contract_canon)
    keys.update(canonicalize_feature_keys(raw_cell))
    keys.update(canonicalize_feature_keys(matrix_feats))
    keys.update(canonicalize_feature_keys(overlay))
    keys.update(canonicalize_feature_keys(extras))
    keys.update(canonicalize_feature_keys(legacy_feats))
    keys.update(_all_matrix_cell_canon_keys(merged_settings))
    keys.update(CANONICAL_PRODUCT_FEATURES)
    keys.update(canonicalize_feature_keys(GLOBAL_SYSTEM_FEATURES))
    return sorted(k for k in keys if k)


@dataclass
class MissingFeatureExplanation:
    feature_key: str
    expected_from: list[str] = field(default_factory=list)
    denied_by: list[str] = field(default_factory=list)
    missing_reason: str = ""
    resolution_details: list[str] = field(default_factory=list)


def _build_missing_feature_explanations(
    *,
    target: User,
    contract_canon: list[str],
    contract_normalized: list[str],
    merged_settings: dict[str, Any],
    eff: list[str],
    resolution_kind: str,
    resolved_dept: str,
    resolved_slot: str,
    matrix_ok: bool,
    matrix_feats_list: list[str],
    matrix_missing_cell: bool,
    raw_cell: list[str],
    denied_contract: list[str],
    overlay: list[str],
    extras: list[str],
    legacy_feats: list[str],
    legacy_bucket: str | None,
    tenant_role_slug: str | None,
    feature_deny: list[str],
    hr_row: PulseWorkerHR | None,
) -> list[MissingFeatureExplanation]:
    eff_set = set(canonicalize_feature_keys(eff))
    contract_set = set(contract_canon)
    matrix_set = set(canonicalize_feature_keys(matrix_feats_list))
    overlay_set = set(canonicalize_feature_keys(overlay))
    extras_set = set(canonicalize_feature_keys(extras))
    legacy_set = set(canonicalize_feature_keys(legacy_feats))
    raw_cell_set = set(canonicalize_feature_keys(raw_cell))
    denied_contract_set = set(denied_contract)

    universe = _candidate_feature_universe(
        contract_canon=contract_canon,
        merged_settings=merged_settings,
        raw_cell=raw_cell,
        matrix_feats=matrix_feats_list,
        overlay=overlay,
        extras=extras,
        legacy_feats=legacy_feats,
    )

    out: list[MissingFeatureExplanation] = []
    for key in universe:
        if key in eff_set:
            continue

        expected_from: list[str] = []
        denied_by: list[str] = []
        details: list[str] = []

        if key in contract_set:
            expected_from.append("contract")
        if key in CANONICAL_PRODUCT_FEATURES:
            expected_from.append("product_catalog")
        if key in canonicalize_feature_keys(GLOBAL_SYSTEM_FEATURES):
            expected_from.append("system_feature_registry")
        if key in raw_cell_set:
            expected_from.append("matrix_cell_raw")
        if key in matrix_set:
            expected_from.append("matrix_effective")
        if key in overlay_set:
            expected_from.append("tenant_role_overlay")
        if key in extras_set:
            expected_from.append("feature_allow_extra")
        if key in legacy_set:
            expected_from.append("legacy_role_feature_access")
        other_slots = _matrix_slots_with_feature(merged_settings, resolved_dept, key)
        if other_slots:
            expected_from.append(f"matrix_other_slot:{','.join(other_slots)}")

        mapped_rbac = FEATURE_TO_RBAC_PERMISSIONS.get(key) or FEATURE_TO_RBAC_PERMISSIONS.get(
            next((c for c in contract_normalized if to_canonical_feature_key(c) == key), ""),
        )
        if mapped_rbac:
            expected_from.append("rbac_bridge_mapping")

        if not to_canonical_feature_key(key) and key not in CANONICAL_PRODUCT_FEATURES:
            out.append(
                MissingFeatureExplanation(
                    feature_key=key,
                    expected_from=expected_from or ["unknown"],
                    denied_by=["unknown_catalog"],
                    missing_reason="unknown_feature_key",
                    resolution_details=[
                        "Key is not a recognized canonical product feature — check contract alias / legacy naming.",
                    ],
                ),
            )
            continue

        details.append(f"resolved_department={resolved_dept!r}")
        details.append(f"resolved_slot={resolved_slot!r}")
        if hr_row is None:
            details.append("No PulseWorkerHR row — matrix department defaults to maintenance when HR slugs absent.")
        else:
            slugs = getattr(hr_row, "department_slugs", None)
            if slugs:
                details.append(f"HR department_slugs={list(slugs)!r}")

        if tenant_role_slug == "no_access":
            denied_by.append("no_access_overlay")
            out.append(
                MissingFeatureExplanation(
                    feature_key=key,
                    expected_from=expected_from,
                    denied_by=denied_by,
                    missing_reason="explicit_deny",
                    resolution_details=details
                    + ["tenant_role.slug=no_access clears all enabled_features regardless of matrix."],
                ),
            )
            continue

        coarse_deny_hit = [d for d in feature_deny if key in d or d in (key, f"{key}.*", f"module.{key}")]
        if coarse_deny_hit:
            details.append(
                f"User permission_deny includes {coarse_deny_hit!r} — coarse deny may affect PermissionService "
                "(does not subtract enabled_features; listed for investigation).",
            )

        if key not in contract_set:
            denied_by.append("contract")
            out.append(
                MissingFeatureExplanation(
                    feature_key=key,
                    expected_from=expected_from,
                    denied_by=denied_by,
                    missing_reason="filtered_by_contract",
                    resolution_details=details
                    + ["Feature is not licensed on the tenant contract (company_features / contract_features)."],
                ),
            )
            continue

        if key in denied_contract_set:
            denied_by.append("contract")
            out.append(
                MissingFeatureExplanation(
                    feature_key=key,
                    expected_from=expected_from,
                    denied_by=denied_by,
                    missing_reason="filtered_by_contract",
                    resolution_details=details
                    + [
                        "Matrix cell lists this module but canonical key was removed by ∩ contract normalization.",
                    ],
                ),
            )
            continue

        if resolution_kind == "tenant_full_admin" or resolution_kind == "system_admin_contract":
            out.append(
                MissingFeatureExplanation(
                    feature_key=key,
                    expected_from=expected_from,
                    denied_by=["resolver_catalog_gap"],
                    missing_reason="admin_resolver_gap",
                    resolution_details=details
                    + [
                        f"Tenant admin / system resolver path should include contract modules; "
                        f"effective_enabled_features={sorted(eff_set)!r}.",
                    ],
                ),
            )
            continue

        if resolution_kind == "matrix_primary":
            if key in overlay_set and key not in matrix_set and key not in extras_set:
                denied_by.extend(["matrix", "overlay_ignored"])
                out.append(
                    MissingFeatureExplanation(
                        feature_key=key,
                        expected_from=expected_from,
                        denied_by=denied_by,
                        missing_reason="overlay_ignored_under_matrix_primary",
                        resolution_details=details
                        + [
                            "tenant_role.feature_keys present on overlay but matrix-primary policy does not merge overlay into enabled_features.",
                            "Use feature_allow_extra or matrix cell to grant.",
                        ],
                    ),
                )
                continue

            alt_slots = [s for s in other_slots if s != resolved_slot]
            if alt_slots and key not in matrix_set:
                denied_by.append("matrix")
                out.append(
                    MissingFeatureExplanation(
                        feature_key=key,
                        expected_from=expected_from,
                        denied_by=denied_by,
                        missing_reason="slot_mismatch",
                        resolution_details=details
                        + [
                            f"Matrix includes {key!r} for department {resolved_dept!r} in slot(s) {alt_slots!r}, "
                            f"but resolved slot is {resolved_slot!r}.",
                            "Adjust HR job title / JWT role tier or matrix row for the resolved slot.",
                        ],
                    ),
                )
                continue

            if matrix_missing_cell:
                denied_by.append("matrix")
                out.append(
                    MissingFeatureExplanation(
                        feature_key=key,
                        expected_from=expected_from,
                        denied_by=denied_by,
                        missing_reason="matrix_cell_empty",
                        resolution_details=details
                        + [
                            f"Matrix configured but cell {resolved_dept!r}/{resolved_slot!r} is missing or empty.",
                        ],
                    ),
                )
                continue

            if key not in matrix_set and key not in extras_set:
                denied_by.append("matrix")
                out.append(
                    MissingFeatureExplanation(
                        feature_key=key,
                        expected_from=expected_from,
                        denied_by=denied_by,
                        missing_reason="disabled_in_matrix",
                        resolution_details=details
                        + [
                            f"Matrix row {resolved_dept!r}/{resolved_slot!r} does not include {key!r}.",
                            "Contract allows this module; grant via Team Management matrix or feature_allow_extra.",
                        ],
                    ),
                )
                continue

            if key not in extras_set and key not in matrix_set:
                denied_by.append("feature_allow_extra")
                out.append(
                    MissingFeatureExplanation(
                        feature_key=key,
                        expected_from=expected_from,
                        denied_by=denied_by,
                        missing_reason="feature_allow_extra_absent",
                        resolution_details=details
                        + ["Module would require per-user feature_allow_extra; none configured."],
                    ),
                )
                continue

        elif resolution_kind == "legacy_role_feature_access_fallback":
            if key not in legacy_set and key not in extras_set:
                denied_by.append("legacy_role_feature_access")
                out.append(
                    MissingFeatureExplanation(
                        feature_key=key,
                        expected_from=expected_from,
                        denied_by=denied_by,
                        missing_reason="legacy_fallback_skipped",
                        resolution_details=details
                        + [
                            f"Legacy bucket {legacy_bucket!r} role_feature_access does not include {key!r}.",
                            "Matrix is unset — only legacy bucket ∪ feature_allow_extra applies.",
                        ],
                    ),
                )
                continue

        # Contract includes module but production resolver excluded it without a clearer branch.
        denied_by.append("effective_resolver")
        out.append(
            MissingFeatureExplanation(
                feature_key=key,
                expected_from=expected_from,
                denied_by=denied_by,
                missing_reason="not_in_effective_enabled_features",
                resolution_details=details
                + [
                    "effective_tenant_feature_names_for_user (production) did not return this key.",
                    f"resolution_kind={resolution_kind!r}",
                ],
            ),
        )

    return sorted(out, key=lambda x: x.feature_key)


def _legacy_bucket_name(user: User) -> str | None:
    if user_has_any_role(user, UserRole.manager):
        return "manager"
    if user_has_any_role(user, UserRole.supervisor):
        return "supervisor"
    if user_has_any_role(user, UserRole.lead):
        return "lead"
    if user_has_any_role(user, UserRole.worker):
        return "worker"
    return None


@dataclass
class AccessResolutionDebug:
    user_id: str
    company_id: str | None

    jwt_roles: list[str]

    #: HR fields (pulse_worker_hr snapshot)
    hr_job_title: str | None = None
    hr_department: str | None = None
    hr_department_slugs: list[str] = field(default_factory=list)

    resolved_department: str | None = None
    resolved_slot: str | None = None

    #: Matrix semantics
    matrix_configured: bool = False
    matrix_row_department: str | None = None
    matrix_row_slot: str | None = None
    matrix_cell_raw_features: list[str] = field(default_factory=list)
    matrix_missing_cell: bool = False

    contract_features: list[str] = field(default_factory=list)
    #: Matrix cell after sanitize ∩ contract — same helper as prod
    matrix_features: list[str] = field(default_factory=list)
    #: TenantRole.feature_keys ∩ contract — informational (matrix-primary ignores for enabled_features)
    overlay_features: list[str] = field(default_factory=list)
    feature_allow_extra: list[str] = field(default_factory=list)
    feature_deny_extra: list[str] = field(default_factory=list)

    denied_by_contract: list[str] = field(default_factory=list)

    #: Same list as `/auth/me` `enabled_features` for this hypothetical resolution
    effective_enabled_features: list[str] = field(default_factory=list)
    rbac_permission_keys: list[str] = field(default_factory=list)

    #: tenant role assignment metadata
    tenant_role_id: str | None = None
    tenant_role_slug: str | None = None
    tenant_role_name: str | None = None

    resolution_kind: str = ""
    #: Per canonical feature → human-readable why it appears (or absent from matrix-only expectation)
    source_attribution: dict[str, str] = field(default_factory=dict)

    legacy_bucket: str | None = None
    legacy_role_feature_access_features: list[str] = field(default_factory=list)

    resolution_steps: list[str] = field(default_factory=list)
    session_cache_info: dict[str, Any] | None = None
    warnings: list[str] = field(default_factory=list)

    missing_feature_explanations: list[MissingFeatureExplanation] = field(default_factory=list)
    #: Canonical keys considered when building missing explanations (contract ∪ matrix ∪ catalog).
    candidate_feature_keys: list[str] = field(default_factory=list)
    #: RBAC keys expected from FEATURE_TO_RBAC bridge for effective features but absent from effective_rbac_permission_keys.
    missing_rbac_permission_keys: list[str] = field(default_factory=list)

    def as_json(self) -> dict[str, Any]:
        return asdict(self)


async def compute_access_resolution_debug(
    *,
    db: AsyncSession,
    target: User,
    contract_normalized: list[str],
    merged_settings: dict[str, Any],
    hr_row: PulseWorkerHR | None,
    tenant_role: TenantRole | None,
) -> AccessResolutionDebug:
    """
    Produce a deterministic trace for ``target``.

    Preconditions (caller responsibility):
      - ``contract_normalized``: output of tenant_feature_access `_contract_feature_names_normalized`
      - ``merged_settings``: merged PulseWorkersSettings policy dict for the tenant
      - HR + tenant_role rows aligned with `/auth/me` resolution pipeline
    """
    uid = str(target.id)
    cid = str(target.company_id) if target.company_id else None

    warn: list[str] = []
    steps: list[str] = []

    jwt_roles = list(target.roles or [])
    deny_raw = getattr(target, "permission_deny", None) or []
    feature_deny = [str(x) for x in deny_raw if isinstance(x, str)]
    if feature_deny:
        warn.append(
            "User has `permission_deny` coarse keys — PermissionService overlays may differ; "
            "they are NOT subtracted from `enabled_features`/sidebar resolver."
        )

    extras = _features_from_user_allow_extra(user=target, contract_names=contract_normalized)
    tr_id = getattr(target, "tenant_role_id", None)
    slug = getattr(tenant_role, "slug", None) if tenant_role else None
    tname = getattr(tenant_role, "name", None) if tenant_role else None

    overlay = []
    if tenant_role is not None and slug == "no_access":
        steps.append("tenant_role.slug=no_access ⇒ enabled_features cleared (deny overlay).")
    elif tenant_role is not None:
        overlay = effective_features_from_role(tenant_role, contract_names=contract_normalized)
        if overlay and tr_id:
            warn.append(
                "tenant_role_id assigned — overlay `feature_keys` are NOT merged into enabled_features "
                "(matrix-primary policy); see `overlay_features` below."
            )

    hr_title = getattr(hr_row, "job_title", None) if hr_row else None
    hr_dept = (getattr(hr_row, "department", None) or "").strip() or None if hr_row else None
    hr_slugs: list[str] = []
    if hr_row:
        ds = getattr(hr_row, "department_slugs", None)
        if isinstance(ds, list):
            hr_slugs = [str(x) for x in ds]

    contract_canon = canonical_keys_from_contract(contract_normalized)

    resolved_dept = permission_matrix_department_for_user(target, hr_row)
    resolved_slot = permission_matrix_slot_for_user(target, hr_row)
    matrix_ok = _department_role_matrix_is_configured(merged_settings.get("department_role_feature_access"))

    raw_cell = _raw_matrix_cell_feats(merged_settings, resolved_dept, resolved_slot)
    pre_contract = sorted(set(canonicalize_feature_keys(raw_cell)))
    allowed_contract = set(contract_canon)
    denied_contract = sorted({k for k in pre_contract if k not in allowed_contract})
    matrix_feats: list[str] | None = None
    if matrix_ok:
        matrix_feats = _features_from_department_role_matrix(
            user=target,
            hr=hr_row,
            merged_settings=merged_settings,
            contract_names=contract_normalized,
        )
    simplified_missing = matrix_ok and not raw_cell
    matrix_missing_cell = simplified_missing

    legacy_bucket = _legacy_bucket_name(target)
    legacy_feats: list[str] = []
    if matrix_feats is None and legacy_bucket:
        legacy_feats = _features_from_legacy_role_feature_access(
            user=target,
            merged_settings=merged_settings,
            contract_names=contract_normalized,
        )

    steps.append(f"JWT roles (primary matrix slot drivers): {jwt_roles}")
    steps.append(f"Resolved matrix department_slug={resolved_dept!r}, slot={resolved_slot!r} (HR + JWT).")
    if hr_title:
        steps.append(f"HR job_title={hr_title!r} drives coordination/operations heuristic when worker-tier.")
    if matrix_ok:
        steps.append(f"Matrix configured: YES — row {resolved_dept!r}/{resolved_slot!r} raw_cell={raw_cell}")
        steps.append(f"Matrix cell canon pre-contract={pre_contract}; denied_by_contract(missing_license)={denied_contract}")
        steps.append(f"Matrix features ∩ contract → {matrix_feats}")

        if simplified_missing:
            warn.append(
                f"Matrix is configured globally but department {resolved_dept!r} × slot {resolved_slot!r} "
                "cell is missing or empty — effective matrix modules may be empty."
            )
    elif legacy_bucket:
        steps.append(
            f"Matrix not configured — legacy role_feature_access[{legacy_bucket}] → {legacy_feats}",
        )

    #: Production effective list
    eff = effective_tenant_feature_names_for_user(
        user=target,
        contract_names=contract_normalized,
        merged_settings=merged_settings,
        hr=hr_row,
        tenant_role=tenant_role,
    )

    matrix_feats_list = list(matrix_feats) if matrix_feats is not None else []

    attrib: dict[str, str] = {}

    if target.company_id is None or target.is_system_admin or user_has_any_role(target, UserRole.system_admin):
        resolution_kind = "system_admin_contract"
        steps.append("Resolver path: system operator or missing company ⇒ canonical contract visibility.")
        for k in eff:
            attrib[k] = "resolver:system_admin_contract (canonical contract keys)"
        if matrix_ok:
            warn.append("Tenant matrix rows are informational only for system admins — sidebar uses contract path.")

    elif user_has_tenant_full_admin(target):
        resolution_kind = "tenant_full_admin"
        steps.append("Resolver path: tenant_full_admin ⇒ full tenant module catalog ∪ contract normalization.")
        for k in eff:
            attrib[k] = "resolver:tenant_full_admin (catalog path, not department matrix)"

    elif tenant_role is not None and slug == "no_access":
        resolution_kind = "no_access_overlay"
        steps.append("Resolver path: overlay slug `no_access` ⇒ deny all modules.")
        for k in eff:
            attrib[k] = "unexpected — no_access should yield empty enabled_features"

    elif matrix_feats is not None:
        resolution_kind = "matrix_primary"
        steps.append(
            "Resolver path: department × role-slot matrix (Team Management) ∪ feature_allow_extra.",
        )
        mset = set(matrix_feats_list)
        eset = set(extras)
        for k in eff:
            if k in mset:
                attrib[k] = f"matrix:{resolved_dept}+{resolved_slot}"
            elif k in eset:
                attrib[k] = "feature_allow_extra"
            else:
                attrib[k] = "unknown_layer (inspect resolver normalization)"

    else:
        resolution_kind = "legacy_role_feature_access_fallback"
        steps.append(
            "Resolver path: legacy `role_feature_access` JWT buckets ∪ feature_allow_extra (matrix unset).",
        )
        lb = legacy_bucket or "?"
        lset = set(legacy_feats)
        eset = set(extras)
        for k in eff:
            if k in lset:
                attrib[k] = f"legacy:role_feature_access.{lb}"
            elif k in eset:
                attrib[k] = "feature_allow_extra"
            else:
                attrib[k] = "unknown_layer (inspect resolver normalization)"

    if (
        UserRole.worker.value in jwt_roles
        and resolved_slot == "coordination"
        and (hr_title or "")
    ):
        jtl = str(hr_title).lower()
        if "coordinator" in jtl or "coordination" in jtl:
            warn.append(
                "Coordination matrix slot inferred: job_title contains coordinator/coordination heuristic.",
            )

    rbac = await effective_rbac_permission_keys(
        db,
        target,
        contract_feature_names=contract_normalized,
        effective_feature_names=eff,
    )

    for k in sorted(set(matrix_feats_list) - set(eff)):
        warn.append(f"matrix row included {k!r} post-contract ∩ but effective excludes it.")

    for k in sorted(set(extras)):
        if k not in eff:
            warn.append(f"feature_allow_extra lists {k!r} but effective excludes — likely filtered by ∩ contract/canonical.")

    cache_blob: dict[str, Any] = {
        "hint": "Compare this payload to SPA localStorage/session `enabled_features` + `rbac_permissions`.",
        "stale_warning": (
            "If UI lists modules absent from effective_enabled_features, client session cache likely stale — reload or "
            "`refreshPulseUserFromServer()` after policy changes."
        ),
        "pulse_auth_refresh": "Hard navigation / re-login after deploy.",
    }

    candidates = _candidate_feature_universe(
        contract_canon=contract_canon,
        merged_settings=merged_settings,
        raw_cell=raw_cell,
        matrix_feats=matrix_feats_list,
        overlay=overlay,
        extras=extras,
        legacy_feats=legacy_feats,
    )
    missing_feats = _build_missing_feature_explanations(
        target=target,
        contract_canon=contract_canon,
        contract_normalized=contract_normalized,
        merged_settings=merged_settings,
        eff=eff,
        resolution_kind=resolution_kind,
        resolved_dept=str(resolved_dept),
        resolved_slot=str(resolved_slot),
        matrix_ok=bool(matrix_ok),
        matrix_feats_list=matrix_feats_list,
        matrix_missing_cell=bool(matrix_missing_cell),
        raw_cell=raw_cell,
        denied_contract=denied_contract,
        overlay=overlay,
        extras=extras,
        legacy_feats=legacy_feats,
        legacy_bucket=legacy_bucket,
        tenant_role_slug=slug,
        feature_deny=feature_deny,
        hr_row=hr_row,
    )

    bridged_expected = rbac_keys_from_legacy_effective_features(eff)
    rbac_set = set(rbac)
    missing_rbac = sorted(k for k in bridged_expected if k not in rbac_set and "*" not in rbac_set)

    dbg = AccessResolutionDebug(
        user_id=uid,
        company_id=cid,
        jwt_roles=jwt_roles,
        hr_job_title=hr_title,
        hr_department=hr_dept,
        hr_department_slugs=hr_slugs,
        resolved_department=str(resolved_dept),
        resolved_slot=str(resolved_slot),
        matrix_configured=bool(matrix_ok),
        matrix_row_department=str(resolved_dept),
        matrix_row_slot=str(resolved_slot),
        matrix_cell_raw_features=raw_cell,
        matrix_missing_cell=bool(matrix_missing_cell),
        contract_features=list(contract_normalized),
        matrix_features=list(matrix_feats_list),
        overlay_features=list(overlay),
        feature_allow_extra=list(extras),
        feature_deny_extra=list(feature_deny),
        denied_by_contract=list(denied_contract),
        effective_enabled_features=list(eff),
        rbac_permission_keys=list(rbac),
        tenant_role_id=str(tr_id) if tr_id else None,
        tenant_role_slug=slug,
        tenant_role_name=tname,
        resolution_kind=resolution_kind,
        source_attribution=attrib,
        legacy_bucket=legacy_bucket,
        legacy_role_feature_access_features=list(legacy_feats),
        resolution_steps=steps,
        session_cache_info=cache_blob,
        warnings=warn,
        missing_feature_explanations=missing_feats,
        candidate_feature_keys=candidates,
        missing_rbac_permission_keys=missing_rbac,
    )
    dbg.resolution_steps.append(f"effective_tenant_feature_names_for_user (production) ⇒ {dbg.effective_enabled_features}")
    dbg.resolution_steps.append(f"effective_rbac_permission_keys (production) ⇒ {len(rbac)} keys")
    dbg.resolution_steps.append(
        f"missing_feature_explanations ⇒ {len(missing_feats)} keys "
        f"(universe {len(candidates)} candidates, granted {len(eff)})",
    )

    return dbg


async def debug_user_access(
    *,
    db: AsyncSession,
    target: User,
    contract_normalized: list[str],
    merged_settings: dict[str, Any],
    hr_row: PulseWorkerHR | None,
    tenant_role: TenantRole | None,
) -> AccessResolutionDebug:
    """Alias for :func:`compute_access_resolution_debug` (explicit debugger entrypoint)."""
    return await compute_access_resolution_debug(
        db=db,
        target=target,
        contract_normalized=contract_normalized,
        merged_settings=merged_settings,
        hr_row=hr_row,
        tenant_role=tenant_role,
    )
