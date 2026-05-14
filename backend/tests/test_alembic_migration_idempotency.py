"""
CI stability: ``alembic upgrade head`` must succeed on an already-migrated database.

Requires the session-scoped ``test_database`` fixture (PostgreSQL + initial upgrade).
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest

BACKEND_ROOT = Path(__file__).resolve().parent.parent


def _run_upgrade() -> subprocess.CompletedProcess[str]:
    url = (os.environ.get("DATABASE_URL") or "").strip()
    assert url, "DATABASE_URL must be set by test_database session"
    env = os.environ.copy()
    env["DATABASE_URL"] = url
    return subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=BACKEND_ROOT,
        env=env,
        capture_output=True,
        text=True,
        timeout=600,
    )


@pytest.mark.integration
def test_alembic_upgrade_head_idempotent(test_database) -> None:
    """Second upgrade on the same DB must exit 0 (migrations are idempotent at head)."""
    first = _run_upgrade()
    assert first.returncode == 0, first.stderr or first.stdout
    second = _run_upgrade()
    assert second.returncode == 0, second.stderr or second.stdout
