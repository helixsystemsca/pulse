# Fix Missing UnifiedFacilityMap — integration.md

## CURSOR PROMPT
"Read handoff/integration.md. Execute the single fix. Commit when done."

---

## ROOT CAUSE
frontend/app/live-map/page.tsx imports UnifiedFacilityMap but that file
does not exist. Cursor previously wired the page to use existing components
LiveFacilityMap and DemoLiveMap instead of creating UnifiedFacilityMap.

Fix: check which map components actually exist and update the import.

---

=== MODIFY: frontend/app/live-map/page.tsx ===

ACTION: fix the import to use whatever map components actually exist

Step 1 — Check which files exist:
```bash
ls frontend/components/pulse/ | grep -i "map\|Map"
ls frontend/components/demo/ | grep -i "map\|Map"
```

Step 2 — Based on what exists, update the import in live-map/page.tsx:

IF LiveFacilityMap.tsx exists at frontend/components/pulse/LiveFacilityMap.tsx:
  Replace the two UnifiedFacilityMap usages with:
  - Live tab: <LiveFacilityMap pollMs={3000} />
  - Demo tab: <DemoLiveMap /> (import from "@/components/demo/DemoLiveMap")

IF UnifiedFacilityMap.tsx exists at frontend/components/pulse/UnifiedFacilityMap.tsx:
  The import path is correct — no change needed, something else is wrong.

Step 3 — Remove the UnifiedFacilityMap import line entirely and replace with
the correct imports for whichever components exist.

Step 4 — Adjust JSX usage to match the props the actual components accept.
  LiveFacilityMap accepts: className, compact, pollMs
  DemoLiveMap accepts: (check its props — likely no required props)

---

## EXECUTION STEPS
1. Check which map component files actually exist in the repo
2. Fix the import in frontend/app/live-map/page.tsx
3. Replace UnifiedFacilityMap JSX with correct component names and props
4. git add -A && git commit -m "fix: resolve missing UnifiedFacilityMap import in live-map page"
5. git push origin main

---

## VALIDATION
- [ ] npm run build passes locally
- [ ] No module not found errors
- [ ] /live-map page loads with Live Hardware and Demo Scenario tabs
- [ ] Vercel deploys successfully
