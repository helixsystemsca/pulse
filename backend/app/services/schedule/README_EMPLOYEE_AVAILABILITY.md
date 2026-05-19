# Employee availability (auxiliary schedule builder)

Normalized per-day rows in `employee_availability` power drag/drop highlights in the schedule UI. This is **input data only** — it does not create assigned shifts or auto-generate schedules.

## Status values

| Status | Meaning |
|--------|---------|
| `unavailable` | Hard block — cannot drop worker on this date |
| `available` | Confirmed / preferred window (`start_time` / `end_time` optional) |
| `conditional` | Allowed with warning; use `restriction_type` |
| `open_pickup` | Eligible but unconfirmed — drop allowed (blue) |

**Blank days** (no row) are **not** unavailable — they are treated as pickup-eligible in the UI.

## Restriction types

`days_only`, `afternoons_only`, `nights_only`, `gg_only`, `day_afternoon_only`, `overnight_only`

Precedence: explicit `unavailable` overrides all other rows on that date.

## Development seed

- Dataset: `data/june_2026_aux_availability.json`
- Service: `employee_availability_service.py`
- CLI: `python -m scripts.seed_aux_availability_june`
- API (non-production): `POST /api/v1/pulse/schedule/employee-availability/dev/seed-june-2026-aux`

Rows are tagged `source=development_seed` and wiped before re-seed for June 2026 only.

## Future imports

Implement adapters that produce the same row dicts and call `import_availability_rows()`.
