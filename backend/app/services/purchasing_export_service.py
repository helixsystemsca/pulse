"""Monthly expense export for quick purchases."""

from __future__ import annotations

from datetime import date
from io import BytesIO

from openpyxl import Workbook
from openpyxl.styles import Font

from app.models.domain import PurchasingQuickPurchase


def build_expense_workbook(
    purchases: list[PurchasingQuickPurchase],
    *,
    period_label: str,
) -> tuple[bytes, str]:
    wb = Workbook()
    ws = wb.active
    ws.title = "Expenses"
    ws.append([f"Expense export — {period_label}"])
    ws.append([])
    headers = ["Purchase Date", "Vendor", "Amount", "Receipt Reference", "Notes"]
    ws.append(headers)
    for cell in ws[3]:
        cell.font = Font(bold=True)

    for p in purchases:
        receipt_ref = p.receipt_filename if p.receipt_filename else "No"
        ws.append(
            [
                p.purchase_date.isoformat() if p.purchase_date else "",
                p.vendor_name or "",
                float(p.total_amount),
                receipt_ref,
                p.notes or "",
            ]
        )

    buf = BytesIO()
    wb.save(buf)
    safe = period_label.replace(" ", "_").replace("/", "-")[:40]
    return buf.getvalue(), f"purchasing-expenses-{safe}.xlsx"
