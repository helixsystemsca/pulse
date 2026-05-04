# Pool Shutdown — Master checklist & schedule (Apr 10–18)

This file is the **human checklist** (verbatim line items below).  
Structured tasks for Pulse live in **`docs/pool-shutdown-tasks-apr-10-18.json`** (regenerated from the blueprint).

## Import into Pulse

From `backend/`:

```text
set POOL_SHUTDOWN_PROJECT_ID=<pulse-project-uuid>
python -m scripts.import_pool_shutdown_schedule --replace
```

- **Blueprint:** `backend/scripts/pool_shutdown_task_blueprint.py` — one task per checklist line; **minimal dependencies** (mainly tile → grout → paint in changerooms; tile → grout on pools/steam; caulk after grout on swirl/leisure). No extra “lag” tasks; dates carry the April 10–18 spacing.
- **Importer:** `backend/scripts/import_pool_shutdown_schedule.py` — no `[CRITICAL]` title prefixes.

## Timeframe

**April 10 → April 18** (inclusive).

---

## Steam Room

- scrub walls and floors  
- tile broken pieces under steam inlet  
- grout walls and floors  
- remove and clean steam generator cover  
- Full clean of Room  
- Generator - drain clean flush and replace sensors  

## Family Changeroom

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

## Mens Changeroom

*(Same items as Family Changeroom.)*

## Womens Changeroom

*(Same items as Family Changeroom.)*

## Toys and Features

- Diving Board — Scrub, Bleach or re-Paint; Inspect all bolts and hardware; Polish stainless steel  
- Pipe Falls — Inspect and replace anodes; Remove rust and repaint  
- Climbing Wall — Powerwash wall; scrub grips; inspect hardware  
- Leisure pool kids features — Function test; remove rust and repaint; bleach teacup; full clean of features; purge airlines  
- Diving Blocks — Inspect hardware; inspect for damage; degrease and scrub; disinfect  

## Swirl Pool

- inspect and repair jets/covers  
- Re-caulk expansion joints  
- inspect drains  
- replace dead lights  
- full scrub of swirl especially scum line  
- tile repair  
- grout tile  

## Leisure Pool

- inspect and repair jets/covers  
- Re-caulk expansion joints  
- inspect drains  
- replace dead lights  
- full scrub of leisure pool especially scum line  
- tile repair  
- grout tile  
- polish stainless steel  

## Lap Pool

- Tile repair  
- grout tile  
- charge filters  
- clean cells  
- repair chlorinator electronic boards  
