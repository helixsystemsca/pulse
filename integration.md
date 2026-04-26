# Fix Vercel Build — integration.md

## CURSOR PROMPT
"Read handoff/integration.md and execute the single fix. Commit when done."

---

=== MODIFY: frontend/app/demo/page.tsx ===
ACTION: remove the CURSOR_PROMPT export block entirely

FIND and DELETE everything matching this pattern:
```
export const CURSOR_PROMPT = `
...
`;
```

File must only contain:
- `export const metadata = { ... }` (optional)
- `export default function DemoPage() { ... }`

Nothing else exported.

---

## EXECUTION STEPS
1. Open frontend/app/demo/page.tsx
2. Delete the entire `export const CURSOR_PROMPT = ...` block
3. git add -A && git commit -m "fix: remove invalid CURSOR_PROMPT export from demo page"

---

## VALIDATION
- [ ] demo/page.tsx has no exports other than metadata + default
- [ ] Vercel redeploys successfully
