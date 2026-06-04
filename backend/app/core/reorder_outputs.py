"""Tenant-configurable inventory reorder output types."""

from __future__ import annotations

from typing import Any, Literal, Optional

ReorderOutputType = Literal["material_requisition", "email_draft", "shopping_list"]

REORDER_OUTPUT_MATERIAL_REQUISITION: ReorderOutputType = "material_requisition"
REORDER_OUTPUT_EMAIL_DRAFT: ReorderOutputType = "email_draft"
REORDER_OUTPUT_SHOPPING_LIST: ReorderOutputType = "shopping_list"

ALL_REORDER_OUTPUT_TYPES: tuple[ReorderOutputType, ...] = (
    REORDER_OUTPUT_MATERIAL_REQUISITION,
    REORDER_OUTPUT_EMAIL_DRAFT,
    REORDER_OUTPUT_SHOPPING_LIST,
)

DEFAULT_REORDER_OUTPUTS: list[ReorderOutputType] = [REORDER_OUTPUT_MATERIAL_REQUISITION]

_REORDER_OUTPUT_SET = set(ALL_REORDER_OUTPUT_TYPES)

# Legacy wizard `procurement_mode` → default outputs when `reorder_outputs` is absent.
_PROCUREMENT_MODE_OUTPUTS: dict[str, list[ReorderOutputType]] = {
    "excel": [REORDER_OUTPUT_MATERIAL_REQUISITION],
    "shopping_list": [REORDER_OUTPUT_SHOPPING_LIST],
    "email": [REORDER_OUTPUT_EMAIL_DRAFT],
    "erp": [REORDER_OUTPUT_MATERIAL_REQUISITION],
    "manual": [REORDER_OUTPUT_MATERIAL_REQUISITION],
}


def _dedupe(outputs: list[ReorderOutputType]) -> list[ReorderOutputType]:
    seen: set[ReorderOutputType] = set()
    out: list[ReorderOutputType] = []
    for item in outputs:
        if item in seen:
            continue
        seen.add(item)
        out.append(item)
    return out


def normalize_reorder_outputs(
    raw: Any,
    *,
    procurement_mode: Optional[str] = None,
) -> list[ReorderOutputType]:
    """Return validated reorder outputs; fall back to procurement_mode or MR default."""
    if isinstance(raw, list) and raw:
        parsed: list[ReorderOutputType] = []
        for item in raw:
            key = str(item).strip()
            if key in _REORDER_OUTPUT_SET:
                parsed.append(key)  # type: ignore[arg-type]
        if parsed:
            return _dedupe(parsed)

    mode = (procurement_mode or "").strip().lower()
    if mode in _PROCUREMENT_MODE_OUTPUTS:
        return list(_PROCUREMENT_MODE_OUTPUTS[mode])

    return list(DEFAULT_REORDER_OUTPUTS)


def resolve_reorder_outputs_from_settings(settings: dict[str, Any]) -> list[ReorderOutputType]:
    inv = settings.get("inventory")
    procurement_mode = None
    raw_outputs = None
    if isinstance(inv, dict):
        procurement_mode = inv.get("procurement_mode")
        raw_outputs = inv.get("reorder_outputs")
    return normalize_reorder_outputs(raw_outputs, procurement_mode=procurement_mode)
