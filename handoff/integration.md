# Fix LiveFacilityMap Prop Error — integration.md

## CURSOR PROMPT
"Read handoff/integration.md. Execute the fix. Commit when done."

---

## ROOT CAUSE
live-map/page.tsx uses LiveFacilityMap with demoMode and showControls props
but LiveFacilityMap doesn't have those props — they belong to UnifiedFacilityMap.

Cursor resolved the import to LiveFacilityMap instead of UnifiedFacilityMap.

---

## EXECUTION STEPS

Step 1 — Find all map component files:
```bash
find frontend/components -name "*Map*" -o -name "*map*" | grep "\.tsx$"
```

Step 2 — Check if UnifiedFacilityMap exists anywhere:
```bash
find frontend -name "UnifiedFacilityMap.tsx"
```

Step 3A — IF UnifiedFacilityMap.tsx EXISTS:
  Fix frontend/app/live-map/page.tsx:
  - Update the import to point to the correct path
  - Keep demoMode and showControls props as-is

Step 3B — IF UnifiedFacilityMap.tsx does NOT exist:
  Fix frontend/app/live-map/page.tsx by removing the unsupported props:

  FIND:
    <LiveFacilityMap demoMode showControls pollMs={1000} />
  REPLACE WITH:
    <DemoLiveMap />

  Then add the DemoLiveMap import at the top of live-map/page.tsx.
  Find where DemoLiveMap.tsx lives first:
  ```bash
  find frontend/components -name "DemoLiveMap.tsx"
  ```
  Then import from that path.

Step 4 — Verify no other TypeScript errors in the file:
```bash
cd frontend && npx tsc --noEmit 2>&1 | grep "live-map"
```

Step 5 — git add -A && git commit -m "fix: remove invalid demoMode prop from LiveFacilityMap usage"
Step 6 — git push origin main

---

## VALIDATION
- [ ] npm run build passes
- [ ] /live-map Demo Scenario tab renders correctly
- [ ] Vercel deploys successfully
