"""RBAC catalog / registry consistency."""

from __future__ import annotations

from app.core.rbac.catalog import RBAC_KEY_REQUIRES_COMPANY_FEATURE, RBAC_PERMISSION_SEED
from app.core.rbac.keys import RbacPermissionKey
from app.core.rbac.registry import ALL_KNOWN_RBAC_KEYS, PERMISSION_REGISTRY, assert_known_rbac_keys


def test_registry_covers_seed() -> None:
    seeded = {k for k, _ in RBAC_PERMISSION_SEED}
    assert seeded == ALL_KNOWN_RBAC_KEYS
    assert set(PERMISSION_REGISTRY.keys()) == ALL_KNOWN_RBAC_KEYS


def test_enum_values_match_registry() -> None:
    assert set(RbacPermissionKey) == ALL_KNOWN_RBAC_KEYS


def test_assert_known_rbac_keys_rejects_unknown() -> None:
    try:
        assert_known_rbac_keys("monitoring.view", "not.a.real.permission.key")
    except ValueError as e:
        assert "not.a.real.permission.key" in str(e)
    else:
        raise AssertionError("expected ValueError")


def test_every_catalog_key_maps_company_feature_or_skipped() -> None:
    for key in ALL_KNOWN_RBAC_KEYS:
        assert key in RBAC_KEY_REQUIRES_COMPANY_FEATURE
        assert RBAC_KEY_REQUIRES_COMPANY_FEATURE[key] is not None
