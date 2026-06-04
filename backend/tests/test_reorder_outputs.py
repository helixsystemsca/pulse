"""Reorder output configuration and handler helpers."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.core.reorder_outputs import (
    DEFAULT_REORDER_OUTPUTS,
    normalize_reorder_outputs,
    resolve_reorder_outputs_from_settings,
)
from app.services.reorder_output_handlers import (
    UNASSIGNED_VENDOR_LABEL,
    _format_shopping_list_text,
    _group_lines_by_vendor,
)


def test_default_reorder_outputs() -> None:
    assert DEFAULT_REORDER_OUTPUTS == ["material_requisition"]


def test_normalize_reorder_outputs_dedupes() -> None:
    out = normalize_reorder_outputs(
        ["material_requisition", "email_draft", "material_requisition"],
    )
    assert out == ["material_requisition", "email_draft"]


def test_normalize_falls_back_to_procurement_mode() -> None:
    assert normalize_reorder_outputs(None, procurement_mode="shopping_list") == ["shopping_list"]
    assert normalize_reorder_outputs([], procurement_mode="email") == ["email_draft"]


def test_resolve_from_settings_prefers_explicit_outputs() -> None:
    settings = {
        "inventory": {
            "procurement_mode": "excel",
            "reorder_outputs": ["shopping_list", "email_draft"],
        }
    }
    assert resolve_reorder_outputs_from_settings(settings) == ["shopping_list", "email_draft"]


def test_group_lines_by_vendor_unassigned() -> None:
    rows = [
        SimpleNamespace(
            item_name="Chlorine",
            sku="CHL-1",
            vendor_part_number=None,
            reorder_qty=5,
            vendor=None,
            unit="EACH",
        ),
        SimpleNamespace(
            item_name="Bearing Kit",
            sku="BRG-2",
            vendor_part_number=None,
            reorder_qty=2,
            vendor="ABC Industrial",
            unit="EACH",
        ),
    ]
    groups = _group_lines_by_vendor(rows)  # type: ignore[arg-type]
    vendors = [g["vendor"] for g in groups]
    assert "ABC Industrial" in vendors
    assert UNASSIGNED_VENDOR_LABEL in vendors


def test_shopping_list_text_format() -> None:
    groups = _group_lines_by_vendor(
        [
            SimpleNamespace(
                item_name="Item A",
                sku="A1",
                vendor_part_number=None,
                reorder_qty=5,
                vendor="Vendor X",
                unit="EACH",
            )
        ]
    )  # type: ignore[arg-type]
    text = _format_shopping_list_text("Kent", groups)
    assert "SHOPPING LIST" in text
    assert "Vendor: Vendor X" in text
    assert "☐ Item A x5" in text
