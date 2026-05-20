# Matrix slot authorization audit

Last updated: organizational model cleanup (department baselines + unresolved state).

## Departments × matrix rows

| Department | Baseline slot | Elevated slots | Former fallback |
|------------|---------------|----------------|-----------------|
| maintenance | `operations` | lead, supervisor, manager | `team_member` |
| communications | `coordination` | supervisor, manager | `team_member` |
| reception | `coordination` | supervisor, manager | `team_member` |
| aquatics | `aquatics_staff` | lead, supervisor, manager | `team_member` |
| fitness | `fitness_staff` | lead, supervisor, manager | `team_member` |
| racquets | `racquets_staff` | lead, supervisor, manager | `team_member` |
| admin | `admin_staff` | supervisor, manager | `team_member` |

`team_member` remains a **compatibility row** in stored permission matrices only — not an operational identity for frontline workers.

## Resolver order (authoritative)

1. Explicit `PulseWorkerHR.matrix_slot`
2. Elevated inference: JWT manager / supervisor / lead
3. Elevated inference: job title keywords (coordination, operations)
4. **Department baseline** (`department_baseline` source)
5. **Unresolved** (`unresolved` source) — missing/invalid department only

Optional env `REQUIRE_EXPLICIT_ELEVATED_SLOTS`: suppresses inferred/ baseline slots → `unresolved` + `explicit_required_policy`.

## Source semantics

| Source | Meaning | UI treatment |
|--------|---------|--------------|
| `explicit_matrix_slot` | HR field set | Normal (green) |
| `jwt_role` | JWT tier | Inferred |
| `job_title_inference` | Title keyword | Inferred |
| `department_baseline` | Department default row | Normal info |
| `unresolved` | Cannot assign department slot | Warning |
| `explicit_required_policy` | Policy blocked inference | Policy |

## Usage counts

Run before/after migration:

```bash
cd backend
python scripts/matrix_slot_migration_report.py
```

Report sections: per-department resolved slot histogram, `team_member` fallback count, unresolved count, HR records eligible for baseline migration.
