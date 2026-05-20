"""Dashboard surface grants for matrix baseline slots."""

from __future__ import annotations

from app.core.dashboard_matrix_grants import augment_canonical_dashboard_grants


def test_maintenance_operations_gets_operations_dashboard() -> None:
    contract = frozenset({"dashboard", "dashboard_operations", "compliance", "monitoring"})
    out = augment_canonical_dashboard_grants(
        "maintenance",
        "operations",
        ["compliance", "monitoring"],
        contract_canonical=contract,
        contract_names=["dashboard", "dashboard_operations", "compliance", "monitoring"],
    )
    assert "dashboard_operations" in out
    assert "compliance" in out


def test_no_dashboard_contract_skips_grant() -> None:
    out = augment_canonical_dashboard_grants(
        "maintenance",
        "operations",
        ["compliance"],
        contract_canonical=frozenset({"compliance"}),
    )
    assert "dashboard_operations" not in out


def test_communications_coordination_matrix_dashboard_does_not_implicitly_grant_dept_flyout() -> None:
    """Matrix `dashboard` is the parent module only — dept flyouts require an explicit matrix toggle."""
    out = augment_canonical_dashboard_grants(
        "communications",
        "coordination",
        ["dashboard"],
        contract_canonical=frozenset({"dashboard"}),
        contract_names=["dashboard"],
    )
    assert out == ["dashboard"]


def test_communications_coordination_grants_dept_dashboard_when_matrix_lists_flyout() -> None:
    out = augment_canonical_dashboard_grants(
        "communications",
        "coordination",
        ["dashboard_dept_communications"],
        contract_canonical=frozenset({"dashboard", "dashboard_dept_communications"}),
        contract_names=["dashboard"],
    )
    assert "dashboard_dept_communications" in out
