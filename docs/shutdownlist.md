# Pool Shutdown — Master Task List & Critical Path (Apr 10–18)

This document is the **human-facing master** for a facility pool / changeroom / steam shutdown.  
**Machine-readable schedule** (titles, descriptions, dates, dependencies, areas, priorities, critical vs parallel):  
[`pool-shutdown-tasks-apr-10-18.json`](pool-shutdown-tasks-apr-10-18.json)

**Import into Pulse (real project tasks + dependency edges):** from repo `backend/`:

```text
set POOL_SHUTDOWN_PROJECT_ID=<your-pulse-project-uuid>
python -m scripts.import_pool_shutdown_schedule

:: Destructive: delete all tasks in that project first, then import
python -m scripts.import_pool_shutdown_schedule --replace
```

Blueprint source: `backend/scripts/pool_shutdown_task_blueprint.py`  
Importer: `backend/scripts/import_pool_shutdown_schedule.py`

---

## Timeframe

| Window | Dates (inclusive) |
|--------|---------------------|
| Shutdown | **April 10 → April 18** |

---

## Scheduling methodology

1. **Inspection / selective demolition first** — no tile repair until failed grout/caulk/tile failures are opened and documented.
2. **Wet-finish critical path (per area + all pools)**  
   `tile repair` → **1–2d lag** → `grout` → **2–3d cure hold** → `caulking` → **1–2d cure hold** → `reinstall / water exposure / final wet clean`  
   Curing is modeled as explicit **lag-hold tasks** so the Gantt/dependency engine blocks downstream work.
3. **Paint** only after **grout cure hold** completes (moisture rule).
4. **Parallel lanes** (mechanical, features, dry changeroom work) sit in cure windows to use crew capacity without violating wet sequencing.
5. **Nothing schedules grout or caulking in the last 48h** — closeout is reinstall, disinfection, startup, and verification.

### Critical path (driver tasks)

- **All pool vessels:** demo → tile → grout → **grout cure** → caulk → **caulk cure** → reassembly / startup gates.  
- **Steam room:** same wet chain + generator service in parallel windows.  
- **All changerooms:** same wet chain; paint and stainless after grout cure hold.

### Parallel (non-driver) examples

- Steam generator drain/flush/sensors (during mid-shutdown).  
- Facility-wide filters / chlorinator / jets / drains / lights pass.  
- Diving board, pipe falls, climbing wall, kids’ features, diving blocks.  
- Changeroom dusting, lockers, plumbing checks, lights, door hardware (timed to avoid blocking wet cure).

---

## Phases (aligned to Apr 10–18)

| Phase | Dates (typical) | Contents |
|-------|-----------------|----------|
| **PH1** | Apr 10–11 | Safety brief; facility inspection; demo failed grout/caulk/tile (pools + steam + changerooms). |
| **PH2** | Apr 10–13 | Tile repair (all areas; staggered by dependency). |
| **PH3** | Apr 13–16 | Grout + **mandatory grout cure holds** (lag tasks). |
| **PH4** | Apr 16–17 | Caulking + **caulk cure holds**; parallel paint/stainless where allowed. |
| **PH5** | Apr 11–17 | Mechanical + features + dry changeroom work in cure windows. |
| **PH6** | Apr 15–17 | Finishes after moisture gates (paint lanes, final scrubs, polish). |
| **PH7** | Apr 17–18 | Reinstall grates; fixtures; full clean + disinfection; **system startup + water quality verification**. |

---

## Areas (task grouping)

Tasks carry `location_tag_id` slugs and titles are prefixed **`[CRITICAL]`** for driver-path items in Pulse.

| Area | Slug (approx.) | Notes |
|------|----------------|--------|
| Steam Room | `steam_room` | Tile → grout → cure → caulk → cure → final clean. |
| Family / Mens / Womens changeroom | `family_changeroom`, `mens_changeroom`, `womens_changeroom` | Mirrored work packages. |
| Lap / Leisure / Swirl pools | `lap_pool`, `leisure_pool`, `swirl_pool` | Shared global pools demo gate `G-DEMO-POOLS`. |
| Features & equipment | `features_equipment` | Toys, diving, pipe falls, wall, blocks + global mechanical sweep. |
| Facility-wide | `facility` | Kickoff, inspection, grate reinstall, startup. |

---

## Dependency & lag rules (encoded in JSON)

| Transition | Rule in schedule |
|------------|-------------------|
| Tile → grout | Grout starts only after tile + minimum spacing (dependencies + dates). |
| Grout → next stress / water / caulk | **Grout cure hold** task (2 calendar days in blueprint). |
| Caulk → reinstall / traffic | **Caulk cure hold** task (1 calendar day in blueprint). |
| Grout cure → paint | Changeroom paint depends on **grout cure hold**, not raw grout completion. |
| Final commissioning | `G-WATER-QUALITY` depends on mechanical lanes + fixture reinstall gate. |

---

## Original line-item checklist (verbatim traceability)

The following is the **legacy bullet list** this shutdown was built from. The JSON/blueprint **refines sequencing** and adds dependencies; use JSON as the execution source of truth.

### Steam Room

- scrub walls and floors  
- tile broken pieces under steam inlet  
- grout walls and floors  
- remove and clean steam generator cover  
- Full clean of Room  
- Generator - drain clean flush and replace sensors  

### Family Changeroom

- scrub floors  
- powerwash or scrub walls  
- dust everything (vents, locker tops, partitions, lights, ceilings)  
- Inspect and repair/replace damaged locker mechanisms  
- inspect toilets, sinks, and showers for leaks and damaged  
- Paint (Partitions, walls, ceilings)  
- Inspect and clean grates  
- Polish stainless steel  
- Change light tubes or ballasts  
- Check rubber seals on doors  
- Check door hardware  
- inspect partitions for structural damaged and movement  
- Tile repair  
- Grout tile  
- Remove and clean shower heads  
- Clean/repair shower buttons  
- Full clean and disinfection  

### Mens Changeroom

*(Same line items as Family Changeroom.)*

### Womens Changeroom

*(Same line items as Family Changeroom.)*

### Toys and Features

- Diving Board — Scrub, Bleach or re-Paint; Inspect all bolts and hardware; Polish stainless steel  
- Pipe Falls — Inspect and replace anodes; Remove rust and repaint  
- Climbing Wall — Powerwash wall; scrub grips; inspect hardware  
- Leisure pool kids features — Function test; remove rust and repaint; bleach teacup; full clean of features; purge airlines  
- Diving Blocks — Inspect hardware; inspect for damage; degrease and scrub; disinfect  

### Swirl Pool

- inspect and repair jets/covers  
- Re-caulk expansion joints  
- inspect drains  
- replace dead lights  
- full scrub of swirl especially scum line  
- tile repair  
- grout tile  

### Leisure Pool

- inspect and repair jets/covers  
- Re-caulk expansion joints  
- inspect drains  
- replace dead lights  
- full scrub of leisure pool especially scum line  
- tile repair  
- grout tile  
- polish stainless steel  

### Lap Pool

- Tile repair  
- grout tile  
- charge filters  
- clean cells  
- repair chlorinator electronic boards  

---

## Files in this repo

| File | Role |
|------|------|
| `docs/shutdownlist.md` | This document — methodology + traceability. |
| `docs/pool-shutdown-tasks-apr-10-18.json` | 112 structured tasks with `depends_on_refs`, dates, priorities, `path`: `critical` \| `parallel`. |
| `backend/scripts/pool_shutdown_task_blueprint.py` | Python source of truth for the task graph. |
| `backend/scripts/import_pool_shutdown_schedule.py` | DB importer + `--emit-json` regenerator. |
