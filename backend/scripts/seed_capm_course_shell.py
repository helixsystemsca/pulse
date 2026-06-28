"""
Import empty CAPM course + section shells (no flashcards).

Creates tenant-scoped database records via the training import service.
Idempotent — re-run upserts by slug without duplicating rows.

Usage
-----
  cd backend
  COMPANY_ID=<tenant-uuid> python -m scripts.seed_capm_course_shell

  Or import all CAPM packs (shell + flashcards):
  COMPANY_ID=<uuid> python -m scripts.seed_capm_training_packs

  Or import the JSON via API / Deck management UI:
  data/training/capm-course-shell.json
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from dotenv import load_dotenv

load_dotenv(_ROOT / ".env")

PACK_PATH = _ROOT / "data" / "training" / "capm-course-shell.json"


def _main() -> None:
    company_id = os.getenv("COMPANY_ID", "").strip()
    if not company_id:
        print("ERROR: Set COMPANY_ID to your tenant company UUID.", file=sys.stderr)
        raise SystemExit(1)

    if not PACK_PATH.is_file():
        print(f"ERROR: Pack not found: {PACK_PATH}", file=sys.stderr)
        raise SystemExit(1)

    raw = PACK_PATH.read_text(encoding="utf-8")

    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    from app.services.training_platform.deck_validator import validate_deck_pack
    from app.services.training_platform.import_service import TrainingImportService
    from app.services.training_platform.import_validation import parse_import_pack_json

    validation = parse_import_pack_json(raw)
    if not validation.ok:
        print("ERROR: Pack failed import validation:", file=sys.stderr)
        for err in validation.errors:
            print(f"  [{err.code}] {err.path}: {err.message}", file=sys.stderr)
        raise SystemExit(1)

    dev_report = validate_deck_pack(raw)
    if dev_report.warnings:
        print(f"Note: {len(dev_report.warnings)} developer warning(s) (empty sections expected).")

    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        print("ERROR: DATABASE_URL is not set.", file=sys.stderr)
        raise SystemExit(1)

    engine = create_engine(database_url)
    with Session(engine) as session:
        svc = TrainingImportService(session, company_id=company_id, user_id=None)
        result = svc.import_pack(validation.pack)  # type: ignore[arg-type]
        session.commit()

    print("CAPM course shell imported.")
    print(f"  source: {result.source_name}")
    print(f"  courses created: {result.created.get('courses', 0)}, updated: {result.updated.get('courses', 0)}")
    print(
        f"  sections created: {result.created.get('sections', 0)}, "
        f"updated: {result.updated.get('sections', 0)}"
    )
    print(f"  flashcards: {result.stats.get('flashcards', 0)}")
    print(f"  certifications created: {result.created.get('certifications', 0)}")


if __name__ == "__main__":
    _main()
