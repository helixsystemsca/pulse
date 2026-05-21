"""Format adapter for publication ingest — .txt and .rtf → normalized plain text before parsing."""

from __future__ import annotations

from pathlib import Path

import re

from striprtf.striprtf import rtf_to_text

PublicationInputFormat = str  # "txt" | "rtf" | "unknown"


def looks_like_rtf_payload(raw: str) -> bool:
    head = raw[:4096].lstrip()
    return head.startswith("{\\rtf") or head.startswith("{\rtf")


def detect_input_format(filename: str | None = None, raw: str | None = None) -> PublicationInputFormat:
    if filename:
        ext = Path(filename).suffix.lower()
        if ext == ".rtf":
            return "rtf"
        if ext == ".txt":
            return "txt"
    if raw and looks_like_rtf_payload(raw):
        return "rtf"
    if filename:
        return "unknown"
    return "txt"


def normalize_input_text(text: str) -> str:
    if not text:
        return ""
    t = text.replace("\r\n", "\n").replace("\r", "\n")
    t = t.replace("\u00a0", " ")
    for ch in ("\u200b", "\u200c", "\u200d", "\ufeff"):
        t = t.replace(ch, "")
    while "\n\n\n" in t:
        t = t.replace("\n\n\n", "\n\n")
    return t.strip()


def extract_plain_text_from_raw(raw: str, fmt: PublicationInputFormat | None = None) -> str:
    if not raw:
        return ""
    effective = fmt if fmt and fmt != "unknown" else detect_input_format(raw=raw)
    if effective == "rtf" or (effective == "unknown" and looks_like_rtf_payload(raw)):
        text = rtf_to_text(raw)
    else:
        text = raw
    return normalize_input_text(text)


def preprocess_input(
    raw: str,
    *,
    filename: str | None = None,
    fmt: PublicationInputFormat | None = None,
) -> dict[str, str | bool]:
    source_format = fmt if fmt and fmt != "unknown" else detect_input_format(filename, raw)
    plain = extract_plain_text_from_raw(raw, source_format)
    is_xplor = bool(re.search(r"pstyle:\s*Event", plain, re.I))
    return {
        "plainText": plain,
        "isXplorTagged": is_xplor,
        "sourceFormat": source_format,
    }


def extract_text_from_path(path: str | Path) -> dict[str, str | bool]:
    p = Path(path)
    raw = p.read_text(encoding="utf-8", errors="replace")
    return preprocess_input(raw, filename=p.name)
