# Archived Alembic revisions (pre-alpha baseline)

These migrations built the schema incrementally from `0001_initial_schema` through `0128_rbac_audit_events`.

They are **not** loaded by Alembic. The active chain starts at `../versions/1000_alpha_baseline.py`.

## Why archived

- Alpha product: rollback lineage is not required.
- CI cost: 100+ revisions, merge heads, and idempotency hacks were slow and fragile.
- Fresh installs use `1000_alpha_baseline` (`Base.metadata.create_all`) for the current ORM schema.

## Existing databases

If a database was migrated with the old chain, either:

1. **Reset (dev/CI only):** drop and recreate, then `python scripts/alembic_migrate.py`.
2. **Production (preserve data):** use `python scripts/alembic_migrate.py` on deploy — it stamps
   `1000_alpha_baseline` when `alembic_version` still references an archived id (e.g.
   `0128_rbac_audit_events`), then runs `upgrade head`.
3. **Manual stamp:** `alembic stamp 1000_alpha_baseline` only if schema already matches ORM metadata.

Do not run archived revisions after stamping the baseline.
