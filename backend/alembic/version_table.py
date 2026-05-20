"""
Ensure ``alembic_version.version_num`` can store long revision identifiers.

Alembic's default table uses ``VARCHAR(32)``. This project uses descriptive revision
slugs (``1009_vendor_scope``); we widen to 128 for headroom while keeping new ids short.
"""

from __future__ import annotations

import logging

from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection

_log = logging.getLogger("alembic.version_table")

VERSION_NUM_MIN_WIDTH = 128

# Databases that recorded pre-rename revision ids before the width fix.
REVISION_ID_ALIASES: dict[str, str] = {
    "1001_tenant_role_feature_keys": "1001_role_features",
    "1003_pulse_worker_hr_matrix_slot": "1003_hr_matrix_slot",
    "1004_matrix_department_baselines": "1004_matrix_baselines",
    "1005_tenant_role_assignments": "1005_role_assignments",
    "1006_user_rbac_permission_extra": "1006_rbac_extra",
    "1007_project_schedule_overlay": "1007_schedule_overlay",
    "1008_schedule_department_scope": "1008_schedule_dept",
    "1009_inventory_vendor_contractor_department": "1009_vendor_scope",
    "1010_employee_availability": "1010_availability",
    "1011_staffing_requirements_draft_meta": "1011_staffing_draft",
    "1012_login_event_session_origin": "1012_login_origin",
    "1014_planning_idea_approvals": "1014_idea_approvals",
}


def _character_max_length(conn: Connection, column_name: str = "version_num") -> int | None:
    row = conn.execute(
        text(
            """
            SELECT character_maximum_length
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'alembic_version'
              AND column_name = :col
            LIMIT 1
            """
        ),
        {"col": column_name},
    ).first()
    if not row or row[0] is None:
        return None
    return int(row[0])


def ensure_version_num_width(conn: Connection, *, min_width: int = VERSION_NUM_MIN_WIDTH) -> bool:
    """
    Widen ``alembic_version.version_num`` when the table exists and the column is too narrow.
    Returns True if ALTER was applied.
    """
    if "alembic_version" not in inspect(conn).get_table_names():
        return False
    current = _character_max_length(conn)
    if current is not None and current >= min_width:
        return False
    conn.execute(
        text(f"ALTER TABLE alembic_version ALTER COLUMN version_num TYPE VARCHAR({min_width})")
    )
    conn.commit()
    _log.info(
        "widened alembic_version.version_num to VARCHAR(%s) (was %s)",
        min_width,
        current if current is not None else "unknown",
    )
    return True


def normalize_stored_revision(stored: str | None) -> str | None:
    """Map legacy long revision ids to the active short identifiers."""
    if stored is None:
        return None
    return REVISION_ID_ALIASES.get(stored, stored)


def repair_stored_revision_if_alias(conn: Connection) -> bool:
    """Rewrite ``alembic_version`` when it still holds a pre-rename revision id."""
    if "alembic_version" not in inspect(conn).get_table_names():
        return False
    row = conn.execute(text("SELECT version_num FROM alembic_version LIMIT 1")).first()
    if not row or row[0] is None:
        return False
    stored = str(row[0])
    canonical = normalize_stored_revision(stored)
    if canonical == stored:
        return False
    conn.execute(
        text("UPDATE alembic_version SET version_num = :rev"),
        {"rev": canonical},
    )
    conn.commit()
    _log.info("repaired alembic_version %r -> %r", stored, canonical)
    return True
