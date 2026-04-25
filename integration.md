# Pulse · Unblock Tasks 01 + 16

## ROOT CAUSE
Task 01 failed because `alembic` is not on PATH in Cursor's terminal.
Task 16 failed because migrations haven't run yet (companies.latitude missing).
Fix 01 → 16 resolves itself.

---

## EXECUTION STEPS

### Step 1 — Find alembic
```bash
# Run these in Cursor terminal one at a time until one works:
which alembic
python -m alembic --version
cd backend && python -m alembic --version
cd backend && poetry run alembic --version
cd backend && pipenv run alembic --version
```
Note which command works. Use that form for all alembic calls below.

### Step 2 — Apply migrations
```bash
cd backend
# Replace "python -m alembic" with whatever worked in Step 1
python -m alembic upgrade head
```

### Step 3 — Verify
```bash
python -m alembic current
# Must show: 0070_pulse_config (head)
```

### Step 4 — Run config migration script
```bash
cd backend
python -m scripts.migrate_config_to_pulse_config
```

### Step 5 — Update wiring_prompts.md
Mark Task 01 as `[x]` DONE and Task 16 as `[x]` DONE.

### Step 6 — Commit
```bash
git add -A
git commit -m "task-01+16: apply migrations and run config migration"
```

### Step 7 — Continue queue
Resume from Task 02 (next PENDING in wiring_prompts.md).

---

## VALIDATION
- [ ] `python -m alembic current` shows `0070_pulse_config`
- [ ] `beacon_positions` table exists in Supabase
- [ ] `pulse_config` table exists in Supabase
- [ ] `companies` table has `latitude` and `longitude` columns
- [ ] Tasks 01 + 16 marked DONE in wiring_prompts.md
