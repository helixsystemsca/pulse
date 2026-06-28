"""
Import CAPM course shell + all section flashcard packs into a tenant database.

JSON files under data/training/ are source packs only — they are not loaded
automatically. Run this once per tenant (or re-run to upsert by slug).

Usage
-----
  cd backend
  COMPANY_ID=<tenant-uuid> python -m scripts.seed_capm_training_packs

  Shell only (sections, no flashcards):
  COMPANY_ID=<uuid> python -m scripts.seed_capm_training_packs --shell-only

  Or import via Training → Flashcards → Manage decks → Import deck (one file at a time).
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from dotenv import load_dotenv

load_dotenv(_ROOT / ".env")

DATA_DIR = _ROOT / "data" / "training"
SHELL_PACK = "capm-course-shell.json"


def _pack_paths(*, shell_only: bool) -> list[Path]:
    shell = DATA_DIR / SHELL_PACK
    if not shell.is_file():
        raise FileNotFoundError(f"Shell pack not found: {shell}")
    if shell_only:
        return [shell]
    others = sorted(p for p in DATA_DIR.glob("capm-*.json") if p.name != SHELL_PACK)
    return [shell, *others]


def _import_file(session, company_id: str, path: Path) -> None:
    from app.services.training_platform.import_service import TrainingImportService
    from app.services.training_platform.import_validation import parse_import_pack_json

    raw = path.read_text(encoding="utf-8")
    validation = parse_import_pack_json(raw)
    if not validation.ok:
        print(f"ERROR: {path.name} failed validation:", file=sys.stderr)
        for err in validation.errors:
            print(f"  [{err.code}] {err.path}: {err.message}", file=sys.stderr)
        raise SystemExit(1)

    svc = TrainingImportService(session, company_id=company_id, user_id=None)
    result = svc.import_pack(validation.pack)  # type: ignore[arg-type]
    stats = result.stats
    created = result.created
    print(f"  {path.name}: {result.status}")
    print(
        f"    courses +{created.get('courses', 0)}/~{created.get('courses', 0)} "
        f"sections +{created.get('sections', 0)} flashcards {stats.get('flashcards', 0)}"
    )


def _main() -> None:
    parser = argparse.ArgumentParser(description="Import CAPM training packs into a tenant DB.")
    parser.add_argument(
        "--shell-only",
        action="store_true",
        help="Import only capm-course-shell.json (empty section shells).",
    )
    args = parser.parse_args()

    company_id = os.getenv("COMPANY_ID", "").strip()
    if not company_id:
        print("ERROR: Set COMPANY_ID to your tenant company UUID.", file=sys.stderr)
        raise SystemExit(1)

    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        print("ERROR: DATABASE_URL is not set.", file=sys.stderr)
        raise SystemExit(1)

    try:
        paths = _pack_paths(shell_only=args.shell_only)
    except FileNotFoundError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc

    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    # Import service uses sync Session (alembic-style URL).
    sync_url = database_url
    if "+asyncpg" in sync_url:
        sync_url = sync_url.replace("postgresql+asyncpg", "postgresql+psycopg", 1)

    print(f"Importing {len(paths)} pack(s) for company {company_id}…")
    engine = create_engine(sync_url)
    with Session(engine) as session:
        for path in paths:
            _import_file(session, company_id, path)
        session.commit()

    print("Done. Open Training -> Flashcards; the CAPM deck should appear.")


if __name__ == "__main__":
    _main()
