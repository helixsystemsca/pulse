"""Excel export for material request drafts (Kent template)."""

from __future__ import annotations

from datetime import date

from app.models.domain import MaterialRequestDraft, MaterialRequestDraftItem
from app.services.template_export_service import TemplateExportError, TemplateExportService


def build_material_request_workbook(
    draft: MaterialRequestDraft,
    items: list[MaterialRequestDraftItem],
) -> tuple[bytes, str]:
    rows = [
        {
            "item_name": it.item_name,
            "vendor": it.vendor,
            "vendor_part_number": it.sku,
            "quantity": float(it.qty_requested),
            "unit": "EACH",
            "reimbursable": False,
        }
        for it in items
    ]
    engine = TemplateExportService()
    try:
        return engine.export(
            rows,
            project=draft.draft_number.replace(" ", "_"),
            location="",
            cost_object="",
            comments=f"Helix draft {draft.draft_number}",
            export_date=date.today(),
        )
    except TemplateExportError:
        raise
