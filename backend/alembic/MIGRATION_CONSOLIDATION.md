# Alembic migration consolidation (alpha)

**Date:** 2026-05-15

## Active migration chain

| Revision | File | Notes |
|----------|------|--------|
| `1000_alpha_baseline` | `versions/1000_alpha_baseline.py` | Full schema via `Base.metadata.create_all` |

**Heads:** 1 (`1000_alpha_baseline`)

**Next migration:** use `down_revision = "1000_alpha_baseline"` and a revision id ≤ 32 chars (e.g. `1001_sched_fix`).

## Archived

| Location | Count |
|----------|------:|
| `alembic/archive/*.py` | 131 |

Includes former `0001`–`0128` chain, merge revisions, and idempotency-heavy historical deltas.

## Stabilization already applied (pre-archive)

- `0103_merge_routine_and_project_summary_heads` → `0103_merge_heads` (archived copy in `archive/`)
- Revision ids > 32 chars shortened in archived files (e.g. `0115_proc_ack_snapshots`)
- `tests/test_migration_ddl_lint.py` enforces: no raw `op.*` structural DDL, revision id length ≤ 32, bind-before-`safe_*` order

## CI impact

| Before | After |
|--------|--------|
| ~131 revisions per `upgrade head` | 1 revision |
| Merge heads / long `version_num` failures | Single head, short revision id |
| Heavy per-revision introspection | Baseline only; new deltas stay small |

## Validation checklist

```bash
cd backend

# Graph
python -m alembic heads          # → 1000_alpha_baseline (head)
python -m alembic history

# Empty database (CI / local Postgres)
dropdb pulse_ci && createdb pulse_ci   # or your DB name
export DATABASE_URL=postgresql+psycopg://...
alembic upgrade head
alembic upgrade head                   # idempotent
alembic downgrade base
alembic upgrade head

pytest tests/test_migration_ddl_lint.py
pytest tests/test_alembic_migration_idempotency.py  # integration
pytest
```

## Manual follow-up

### Fresh databases (CI, new dev)

No action — `alembic upgrade head` applies `1000_alpha_baseline` only.

### Existing databases (old chain already applied)

Schema should already match ORM metadata. After deploy:

```bash
alembic stamp 1000_alpha_baseline
```

Only if you have confirmed the live schema matches current models. Do **not** run archived migrations.

### New migrations

1. `alembic revision -m "short_desc"`
2. Set `revision` to ≤ 32 characters (`1001_feature_x`).
3. Use `ah.safe_*` helpers for additive DDL (see `alembic_helpers.py`).
4. Run `python scripts/migration_lint_lib.py` before push.

## Removed from active path

- Historical merge revisions as live heads
- Incremental bootstrap from `0001` on new installs
- Per-revision defensive logic in archived files (kept in git archive for archaeology only)

New installs do not execute archived files.
