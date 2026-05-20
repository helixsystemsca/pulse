"""CI guard: Alembic revisions must not regress to blind ``op.*`` structural DDL."""

from __future__ import annotations

from pathlib import Path

import pytest

from scripts.migration_lint_lib import scan_versions_directory

_VERSIONS = Path(__file__).resolve().parents[1] / "alembic" / "versions"


def test_alembic_revisions_have_no_raw_structural_op_ddl() -> None:
    issues = scan_versions_directory(_VERSIONS)
    if not issues:
        return
    lines = [f"  {fn}:{ln} [{kind}] {detail}" for fn, ln, detail, kind in issues]
    pytest.fail("Migration DDL lint failed:\n" + "\n".join(lines))
