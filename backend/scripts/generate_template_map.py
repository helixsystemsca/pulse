#!/usr/bin/env python3
"""Regenerate templates/template-map.json from kent_material_request.xlsx."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.services.template_analyzer import generate_template_map  # noqa: E402
from app.services.template_export_paths import template_map_path, templates_dir  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate template-map.json from Excel template")
    parser.add_argument(
        "--workbook",
        type=Path,
        default=templates_dir() / "kent_material_request.xlsx",
        help="Path to .xlsx template",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=template_map_path(),
        help="Output JSON path",
    )
    parser.add_argument("--overwrite", action="store_true", help="Replace existing map file")
    args = parser.parse_args()
    data = generate_template_map(args.workbook, output_path=args.output, overwrite=args.overwrite)
    print(f"Wrote {args.output} ({len(data)} keys)")


if __name__ == "__main__":
    main()
