#!/usr/bin/env python3
"""CLI: validate a flashcard deck JSON file (read-only, no import).

Usage:
  python scripts/validate_flashcard_deck.py path/to/deck.json
  python scripts/validate_flashcard_deck.py path/to/deck.json --format text
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Allow running from backend/ without installing the package.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.training_platform.deck_validator import validate_deck_pack  # noqa: E402


def _format_text(report: dict) -> str:
    lines = [
        f"Deck validation: {report['status'].upper()}",
        f"Source: {report.get('source_name') or '—'}  Version: {report.get('version') or '—'}",
        "",
        "Statistics:",
    ]
    stats = report.get("statistics") or {}
    for key, value in stats.items():
        if key == "by_difficulty":
            lines.append(f"  by_difficulty: {json.dumps(value)}")
        else:
            lines.append(f"  {key}: {value}")
    lines.append("")
    errors = report.get("errors") or []
    warnings = report.get("warnings") or []
    lines.append(f"Errors ({len(errors)}):")
    for item in errors:
        lines.append(f"  [{item['code']}] {item['path']}: {item['message']}")
    lines.append(f"Warnings ({len(warnings)}):")
    for item in warnings:
        lines.append(f"  [{item['code']}] {item['path']}: {item['message']}")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate a flashcard deck JSON file.")
    parser.add_argument("path", type=Path, help="Path to deck JSON file")
    parser.add_argument(
        "--format",
        choices=("json", "text"),
        default="json",
        help="Output format (default: json)",
    )
    args = parser.parse_args()
    raw = args.path.read_text(encoding="utf-8")
    report = validate_deck_pack(raw).to_dict()
    if args.format == "text":
        print(_format_text(report))
    else:
        print(json.dumps(report, indent=2))
    return 0 if report["status"] == "valid" else 1


if __name__ == "__main__":
    raise SystemExit(main())
