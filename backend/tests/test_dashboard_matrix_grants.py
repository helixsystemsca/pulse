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


def test_communications_coordination_grants_dept_dashboard_when_only_parent_on_contract() -> None:
    """Lisa-style: contract has `dashboard` only; matrix cell has `dashboard`."""
    out = augment_canonical_dashboard_grants(
        "communications",
        "coordination",
        ["dashboard"],
        contract_canonical=frozenset({"dashboard"}),
    )
    assert "dashboard_dept_communications" in out
