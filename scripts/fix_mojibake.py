# -*- coding: utf-8 -*-
"""Find and fix UTF-8 mojibake across source files."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCAN_DIRS = [ROOT / "frontend", ROOT / "backend"]
EXTENSIONS = {".tsx", ".ts", ".jsx", ".js", ".md", ".py"}

WRONG_ARROW = "\u00e2\u2020\u2019"

REPLACEMENTS: list[tuple[str, str]] = [
    ("\u00e2\u20ac\u00a6", "\u2026"),
    ("\u00e2\u20ac\u201c", "\u2014"),
    ("\u00e2\u20ac\u0093", "\u2013"),
    ("\u00e2\u20ac\u0099", "\u2019"),
    ("\u00e2\u20ac\u009c", "\u201c"),
    ("\u00e2\u20ac\u009d", "\u201d"),
    ("\u00e2\u0086\u0092", "\u2192"),
    ("\u00c3\u0097", "\u00d7"),
    ("\u00c3\u00a9", "\u00e9"),
    ("\u00c3\u00a8", "\u00e8"),
    ("\u00c2\u00a0", " "),
    ("\u00c2\u00b7", "\u00b7"),
]


def fix_text(text: str) -> tuple[str, int]:
    n = 0
    if WRONG_ARROW in text:
        c = text.count(WRONG_ARROW)
        text = text.replace(WRONG_ARROW, "\u2192")
        n += c
    for old, new in REPLACEMENTS:
        c = text.count(old)
        if c:
            text = text.replace(old, new)
            n += c
    return text, n


def main() -> None:
    total_files = 0
    total_repl = 0
    remain: list[str] = []

    for base in SCAN_DIRS:
        if not base.is_dir():
            continue
        for path in base.rglob("*"):
            if path.suffix not in EXTENSIONS:
                continue
            if "node_modules" in path.parts or ".next" in path.parts:
                continue
            try:
                raw = path.read_text(encoding="utf-8")
            except (UnicodeDecodeError, OSError):
                continue
            fixed, n = fix_text(raw)
            if n:
                path.write_text(fixed, encoding="utf-8", newline="\n")
                print(f"{path.relative_to(ROOT)}: {n}")
                total_files += 1
                total_repl += n
            for i, line in enumerate(fixed.splitlines(), 1):
                if "\u00e2" in line or "\u00c3" in line:
                    if any(
                        seq in line
                        for seq in (
                            "\u20ac",
                            "\u2020",
                            "\u0080",
                            "\u0093",
                            "\u0094",
                            "\u0099",
                        )
                    ):
                        remain.append(f"{path.relative_to(ROOT)}:{i}: {line.strip()[:90]}")

    print(f"\nDone: {total_repl} in {total_files} files")
    if remain:
        print(f"{len(remain)} suspicious lines:")
        for r in remain[:30]:
            print(f"  {r}")


if __name__ == "__main__":
    main()
