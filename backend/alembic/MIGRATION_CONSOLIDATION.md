# Alembic migration consolidation (alpha)

**Date:** 2026-05-15

## Active migration chain

| Revision | File | Notes |
|----------|------|--------|
| `1000_alpha_baseline` | `versions/1000_alpha_baseline.py` | Full schema via `Base.metadata.create_all` |

**Heads:** 1 (`1000_alpha_baseline`)

**Next migration:** use `down_revision` = current head and a **short** revision id (e.g. `1016_sched_fix`). See `alembic/REVISION_NAMING.md`.

**Head (2026-05):** `1015_version_num_128` — active chain `1000` → … → `1015`.

## Archived

| Location | Count |
|----------|------:|
| `alembic/archive/*.py` | 131 |

Includes former `0001`–`0128` chain, merge revisions, and idempotency-heavy historical deltas.

## Stabilization already applied (pre-archive)

- `0103_merge_routine_and_project_summary_heads` → `0103_merge_heads` (archived copy in `archive/`)
- Revision ids > 32 chars shortened in archived files (e.g. `0115_proc_ack_snapshots`)
- Active chain revision ids shortened (e.g. `1009_vendor_scope`); `alembic_version.version_num` widened to VARCHAR(128)
- `tests/test_migration_ddl_lint.py` enforces: no raw `op.*` structural DDL, revision id length ≤ 128, bind-before-`safe_*` order

## CI impact

| Before | After |
|--------|--------|
| ~131 revisions per `upgrade head` | 1 revision |
| Merge heads / long `version_num` failures | Single head, short revision ids + VARCHAR(128) column |
| Heavy per-revision introspection | Baseline only; new deltas stay small |

## Render / production start command

Replace:

```bash
alembic -c alembic.ini upgrade head && uvicorn app.main:app ...
```

With:

```bash
bash scripts/render_start.sh
```

Or split for faster port binding (recommended on Render):

- **Pre-Deploy Command:** `cd backend && python scripts/alembic_migrate.py`
- **Start Command:** `cd backend && exec uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips='*'`

**Health check path:** `/health` (returns `{"status":"ok"}`; no auth, no DB).

Avoid chaining migrations in the same process as uvicorn if deploy logs show “no open ports detected” while migrations run — Render’s port scan can time out before the server listens.

(`alembic_migrate.py` stamps `1000_alpha_baseline` when `alembic_version` still references an archived revision such as `0128_rbac_audit_events`, then runs `upgrade head`.)

## Validation checklist

```bash
cd backend

# Graph
python -m alembic heads          # → 1000_alpha_baseline (head)
python -m alembic history

# Empty database (CI / local Postgres)
dropdb pulse_ci && createdb pulse_ci   # or your DB name
export DATABASE_URL=postgresql+psycopg://...
python scripts/alembic_migrate.py
python scripts/alembic_migrate.py      # idempotent
alembic downgrade base
python scripts/alembic_migrate.py

pytest tests/test_migration_ddl_lint.py
pytest tests/test_alembic_migration_idempotency.py  # integration
pytest
```

## Manual follow-up

### Fresh databases (CI, new dev)

No action — `alembic upgrade head` applies `1000_alpha_baseline` only.

### Existing databases (old chain already applied)

Schema should already match ORM metadata. The deploy script realigns automatically:

```bash
python scripts/alembic_migrate.py   # stamps 1000_alpha_baseline if version_num is archived, then upgrade head
```

Manual one-off (Render shell) if needed:

```bash
alembic stamp 1000_alpha_baseline
```

Only stamp when the live schema already matches current models. Do **not** run archived migrations.

### New migrations

1. `alembic revision -m "short_desc"`
2. Set `revision` to a short slug (`1016_feature_x`); see `REVISION_NAMING.md`.
3. Use `ah.safe_*` helpers for additive DDL (see `alembic_helpers.py`).
4. Run `python scripts/migration_lint_lib.py` before push.

## Removed from active path

- Historical merge revisions as live heads
- Incremental bootstrap from `0001` on new installs
- Per-revision defensive logic in archived files (kept in git archive for archaeology only)

New installs do not execute archived files.
