"""Resolve repository template paths for Excel exports."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path


@lru_cache(maxsize=1)
def _service_file() -> Path:
    return Path(__file__).resolve()


@lru_cache(maxsize=1)
def backend_root() -> Path:
    # backend/app/services -> backend
    return _service_file().parents[2]


@lru_cache(maxsize=1)
def repo_root() -> Path:
    # Monorepo checkout: parent of backend/
    return _service_file().parents[3]


@lru_cache(maxsize=1)
def templates_dir() -> Path:
    """Directory containing template-map.json and workbook files.

    Render often sets the service root to ``backend/``, so templates ship in
    ``backend/templates``. Full-repo checkouts also support ``/templates`` at repo root.
  """
    override = (os.environ.get("PULSE_TEMPLATES_DIR") or "").strip()
    if override:
        return Path(override)

    candidates = (
        backend_root() / "templates",
        repo_root() / "templates",
    )
    for path in candidates:
        if path.is_dir() and (path / "template-map.json").is_file():
            return path
    return candidates[0]


def template_workbook_path(filename: str) -> Path:
    return templates_dir() / filename


def template_map_path() -> Path:
    return templates_dir() / "template-map.json"
