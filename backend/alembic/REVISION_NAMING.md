# Alembic revision identifiers

## Why this matters

Alembic records the applied revision in `alembic_version.version_num`. Upstream Alembic creates that column as **`VARCHAR(32)`**, which is easy to exceed with descriptive slugs such as `1009_inventory_vendor_contractor_department` (43 characters).

This project:

1. **Widens** `version_num` to **`VARCHAR(128)`** before running migrations (`alembic/env.py`, `scripts/alembic_migrate.py`, revision `1015_version_num_128`).
2. **Still uses short revision ids** in active migrations for readable logs and reviews.

## Recommended format

```
{seq}_{short_topic}
```

Examples:

| Good | Length | Avoid |
|------|-------:|-------|
| `1009_vendor_scope` | 16 | `1009_inventory_vendor_contractor_department` |
| `1011_staffing_draft` | 18 | `1011_staffing_requirements_draft_meta` |
| `1013_planning_ideas` | 18 | (OK — under 32) |
| `1015_version_num_128` | 19 | — |

Rules:

- **Target ≤ 32 characters** (safe on legacy DBs before widen runs).
- **Never exceed 128 characters** (enforced by `scripts/migration_lint_lib.py`).
- Use a numeric prefix matching file order (`1001_`, `1002_`, …).
- Use one or two terse topic tokens; put full context in the migration docstring, not the revision id.
- Filename should match the revision id: `1009_vendor_scope.py`.

## Compatibility

| Environment | Behavior |
|-------------|----------|
| Fresh CI / dev DB | `ensure_version_num_width()` runs before `upgrade head`; short ids apply cleanly. |
| Render / production | `python scripts/alembic_migrate.py` widens column, repairs legacy `version_num` aliases, then upgrades. |
| DB with old long `version_num` | `REVISION_ID_ALIASES` in `alembic/version_table.py` maps retired ids to the active short names. |

## Creating a new revision

```bash
cd backend
alembic revision -m "vendor_scope"   # message is separate from revision id
```

Edit the generated file:

```python
revision = "1016_my_feature"   # ≤32 chars recommended; must be ≤128
down_revision = "1015_version_num_128"
```

Run before push:

```bash
python scripts/migration_lint_lib.py
pytest tests/test_migration_ddl_lint.py
```

See also `alembic/MIGRATION_CONSOLIDATION.md` for the alpha baseline and `alembic_helpers` idempotency rules.
