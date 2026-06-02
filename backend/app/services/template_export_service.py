"""Reusable Excel template export engine (load map, populate, preserve styles)."""

from __future__ import annotations

import json
import re
from copy import copy
from dataclasses import dataclass
from datetime import date, datetime
from io import BytesIO
from pathlib import Path
from typing import Any, Mapping, Sequence

from openpyxl import load_workbook
from openpyxl.cell import Cell
from openpyxl.utils import column_index_from_string, get_column_letter
from openpyxl.worksheet.worksheet import Worksheet

from app.services.template_export_paths import template_map_path, template_workbook_path


class TemplateExportError(Exception):
    """User-facing export failure."""


@dataclass(frozen=True)
class TemplateMap:
    raw: dict[str, Any]

    @property
    def template_file(self) -> str:
        return str(self.raw.get("templateFile") or "kent_material_request.xlsx")

    @property
    def sheet_name(self) -> str | None:
        name = self.raw.get("sheetName")
        return str(name) if name else None

    @property
    def first_data_row(self) -> int:
        return int(self.raw.get("firstDataRow") or 8)

    @property
    def last_template_data_row(self) -> int:
        return int(self.raw.get("lastTemplateDataRow") or self.first_data_row)

    def header_cell(self, key: str) -> str | None:
        direct = self.raw.get(f"{key}Cell")
        if direct:
            return str(direct)
        fields = self.raw.get("fields") or {}
        block = fields.get(key) or {}
        cell = block.get("cell")
        return str(cell) if cell else None

    def populate_columns(self) -> dict[str, str]:
        cols = self.raw.get("populateColumns") or self.raw.get("columns") or {}
        return {str(k): str(v) for k, v in cols.items()}


def load_template_map(path: Path | None = None) -> TemplateMap:
    map_path = path or template_map_path()
    if not map_path.is_file():
        raise TemplateExportError(f"Template mapping file not found: {map_path}")
    with map_path.open(encoding="utf-8") as f:
        return TemplateMap(json.load(f))


def load_template(template_map: TemplateMap) -> Any:
    workbook_path = template_workbook_path(template_map.template_file)
    if not workbook_path.is_file():
        raise TemplateExportError(f"Template workbook not found: {workbook_path}")
    return load_workbook(workbook_path)


def _active_sheet(wb: Any, sheet_name: str | None) -> Worksheet:
    if sheet_name and sheet_name in wb.sheetnames:
        return wb[sheet_name]
    return wb.active


def _set_cell(ws: Worksheet, coord: str, value: Any) -> None:
    cell = ws[coord]
    if getattr(cell, "__class__", None).__name__ == "MergedCell":
        for merged in ws.merged_cells.ranges:
            if coord in merged:
                top = ws.cell(merged.min_row, merged.min_col)
                top.value = value
                return
        return
    cell.value = value


def populate_header(
    ws: Worksheet,
    template_map: TemplateMap,
    *,
    project: str,
    location: str,
    cost_object: str,
    comments: str,
    export_date: date | None = None,
) -> None:
    when = export_date or date.today()
    if cell := template_map.header_cell("project"):
        _set_cell(ws, cell, project.strip())
    if cell := template_map.header_cell("location"):
        _set_cell(ws, cell, location.strip())
    if cell := template_map.header_cell("costObject"):
        _set_cell(ws, cell, cost_object.strip())
    if cell := template_map.header_cell("comments"):
        _set_cell(ws, cell, comments.strip())
    if cell := template_map.header_cell("date"):
        _set_cell(ws, cell, when)


def _copy_cell_style(src: Cell, tgt: Cell) -> None:
    if not src.has_style:
        return
    tgt.font = copy(src.font)
    tgt.border = copy(src.border)
    tgt.fill = copy(src.fill)
    tgt.number_format = copy(src.number_format)
    tgt.protection = copy(src.protection)
    tgt.alignment = copy(src.alignment)


def _copy_row_style(ws: Worksheet, src_row: int, tgt_row: int, max_col: int = 12) -> None:
    if src_row in ws.row_dimensions:
        h = ws.row_dimensions[src_row].height
        if h is not None:
            ws.row_dimensions[tgt_row].height = h
    for c in range(1, max_col + 1):
        _copy_cell_style(ws.cell(src_row, c), ws.cell(tgt_row, c))


def _ensure_rows(ws: Worksheet, template_map: TemplateMap, needed_rows: int) -> int:
    """Ensure worksheet has enough styled data rows; return style source row."""
    first = template_map.first_data_row
    style_row = min(template_map.last_template_data_row, first)
    existing = max(0, template_map.last_template_data_row - first + 1)
    if needed_rows <= existing:
        return style_row

    extra = needed_rows - existing
    insert_at = template_map.last_template_data_row + 1
    ws.insert_rows(insert_at, amount=extra)
    for i in range(extra):
        tgt = insert_at + i
        _copy_row_style(ws, style_row, tgt)
    return style_row


def populate_rows(
    ws: Worksheet,
    template_map: TemplateMap,
    rows: Sequence[Mapping[str, Any]],
) -> None:
    if not rows:
        raise TemplateExportError("No items to export")

    cols = template_map.populate_columns()
    first = template_map.first_data_row
    style_row = _ensure_rows(ws, template_map, len(rows))

    line_col = (template_map.raw.get("columns") or {}).get("lineNumber", "A")

    for idx, item in enumerate(rows):
        row_num = first + idx
        if row_num > template_map.last_template_data_row and row_num != first:
            _copy_row_style(ws, style_row, row_num)

        reimb = item.get("reimbursable")
        if reimb is True or (isinstance(reimb, str) and reimb.strip().upper() in ("Y", "YES", "TRUE", "1")):
            reimb_text = "YES"
        else:
            reimb_text = "NO"

        values: dict[str, Any] = {
            "reimbursable": reimb_text,
            "vendor": item.get("vendor") or "",
            "vendorPart": item.get("vendor_part_number") or item.get("vendorPart") or "",
            "description": item.get("item_name") or item.get("description") or "",
            "quantity": item.get("quantity"),
            "unit": item.get("unit") or "",
        }

        if line_col:
            ws[f"{line_col}{row_num}"].value = idx + 1

        for key, col_letter in cols.items():
            if key not in values:
                continue
            val = values[key]
            ws[f"{col_letter}{row_num}"].value = val


def save_workbook(wb: Any) -> bytes:
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def build_filename(pattern: str, *, project: str, export_date: date | None = None) -> str:
    when = (export_date or date.today()).isoformat()
    safe_project = re.sub(r"[^\w\-]+", "_", project.strip().upper())[:48] or "PROJECT"
    return (
        pattern.replace("{project}", safe_project)
        .replace("{date}", when)
        .replace("{PROJECT}", safe_project)
        .replace("{DATE}", when)
    )


class TemplateExportService:
    """Configuration-driven Excel export from disk templates."""

    def __init__(self, map_path: Path | None = None) -> None:
        self._map_path = map_path

    def load_template_map(self) -> TemplateMap:
        return load_template_map(self._map_path)

    def generate_template_map(self, workbook_path: Path, *, overwrite: bool = False) -> TemplateMap:
        from app.services.template_analyzer import generate_template_map

        data = generate_template_map(workbook_path, output_path=self._map_path or template_map_path(), overwrite=overwrite)
        return TemplateMap(data)

    def analyze_template(self, workbook_path: Path) -> dict[str, Any]:
        from app.services.template_analyzer import analyze_template

        return analyze_template(workbook_path)

    def load_template(self, template_map: TemplateMap | None = None) -> tuple[Any, TemplateMap]:
        tm = template_map or self.load_template_map()
        return load_template(tm), tm

    def populate_header(
        self,
        ws: Worksheet,
        template_map: TemplateMap,
        *,
        project: str,
        location: str,
        cost_object: str,
        comments: str,
        export_date: date | None = None,
    ) -> None:
        populate_header(
            ws,
            template_map,
            project=project,
            location=location,
            cost_object=cost_object,
            comments=comments,
            export_date=export_date,
        )

    def populate_rows(self, ws: Worksheet, template_map: TemplateMap, rows: Sequence[Mapping[str, Any]]) -> None:
        populate_rows(ws, template_map, rows)

    def save_workbook(self, wb: Any) -> bytes:
        return save_workbook(wb)

    def export(
        self,
        rows: Sequence[Mapping[str, Any]],
        *,
        project: str,
        location: str,
        cost_object: str = "",
        comments: str = "",
        export_date: date | None = None,
    ) -> tuple[bytes, str]:
        tm = self.load_template_map()
        wb = load_template(tm)
        ws = _active_sheet(wb, tm.sheet_name)
        populate_header(
            ws,
            tm,
            project=project,
            location=location,
            cost_object=cost_object,
            comments=comments,
            export_date=export_date,
        )
        populate_rows(ws, tm, rows)
        pattern = str(tm.raw.get("fileNamePattern") or "MR_{project}_{date}.xlsx")
        filename = build_filename(pattern, project=project, export_date=export_date)
        return save_workbook(wb), filename
