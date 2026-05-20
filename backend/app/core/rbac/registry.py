"""Authoritative flat permission registry (single source for enforcement, introspection, and tests)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final

from app.core.rbac.catalog import RBAC_KEY_REQUIRES_COMPANY_FEATURE, RBAC_PERMISSION_SEED


@dataclass(frozen=True, slots=True)
class PermissionRecord:
    """One catalog permission key."""

    key: str
    description: str
    requires_company_feature: str | None


def _build_registry() -> dict[str, PermissionRecord]:
    out: dict[str, PermissionRecord] = {}
    for key, desc in RBAC_PERMISSION_SEED:
        out[key] = PermissionRecord(
            key=key,
            description=desc,
            requires_company_feature=RBAC_KEY_REQUIRES_COMPANY_FEATURE.get(key),
        )
    return out


PERMISSION_REGISTRY: Final[dict[str, PermissionRecord]] = _build_registry()

ALL_KNOWN_RBAC_KEYS: Final[frozenset[str]] = frozenset(PERMISSION_REGISTRY.keys())


def assert_known_rbac_keys(*keys: str) -> None:
    """Fail fast on typos / orphan keys when wiring routes or tests."""
    unknown = [k for k in keys if k not in ALL_KNOWN_RBAC_KEYS]
    if unknown:
        raise ValueError(f"Unknown RBAC permission key(s): {unknown}. Valid keys are catalogued in rbac.catalog / PERMISSION_REGISTRY.")
