# Fix Settings Suspense — integration.md

## CURSOR PROMPT
"Read handoff/integration.md and execute the fix. Commit when done."

---

=== MODIFY: frontend/app/settings/page.tsx ===
ACTION: wrap SettingsApp in Suspense — useSearchParams requires it in Next.js 14 App Router

REPLACE entire file contents with:

import { Suspense } from "react";
import { SettingsApp } from "@/components/settings/SettingsApp";

export const metadata = {
  title: "Settings · Pulse",
};

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-ds-accent border-t-transparent" />
      </div>
    }>
      <SettingsApp />
    </Suspense>
  );
}

---

## EXECUTION STEPS
1. Replace frontend/app/settings/page.tsx with content above
2. git add -A && git commit -m "fix: wrap SettingsApp in Suspense for useSearchParams"

---

## VALIDATION
- [ ] Vercel build passes
- [ ] /settings loads without error
