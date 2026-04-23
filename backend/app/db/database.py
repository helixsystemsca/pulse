"""
Compatibility wrapper for database module placement.

The codebase uses `app/core/database.py` today; this module re-exports it so
new integrations can follow a `app/db/database.py` structure without churn.
"""

from app.core.database import AsyncSessionLocal, engine, get_db  # noqa: F401

