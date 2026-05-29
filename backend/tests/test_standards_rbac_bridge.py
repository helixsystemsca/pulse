"""Feature bridge grants training compliance RBAC when matrix enables standards_compliance."""

from __future__ import annotations

from app.core.rbac.resolve import rbac_keys_from_legacy_effective_features


def test_standards_compliance_matrix_grants_compliance_view() -> None:
    keys = rbac_keys_from_legacy_effective_features(["standards_compliance"])
    assert "standards.compliance.view" in keys
    assert "standards.training.compliance.view" in keys


def test_standards_training_matrix_grants_training_hub_keys() -> None:
    keys = rbac_keys_from_legacy_effective_features(["standards_training"])
    assert "standards.training.view" in keys
    assert "standards.training.overview.view" in keys
