"""Resolve repository template paths for Excel exports."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path


@lru_cache(maxsize=1)
def repo_root() -> Path:
    # backend/app/services -> repo root
    return Path(__file__).resolve().parents[3]


def templates_dir() -> Path:
    return repo_root() / "templates"


def template_workbook_path(filename: str) -> Path:
    return templates_dir() / filename


def template_map_path() -> Path:
    return templates_dir() / "template-map.json"
