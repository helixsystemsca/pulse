"use client";

import { CalendarDays } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Minimal schedule page title row — actions render on the right (More, drafts, publish).
 * Kept intentionally short (~72–88px) so the calendar can sit higher on the page.
 */
export function SchedulePageHeader({ actions }: { actions: ReactNode }) {
  return (
    <header className="flex min-h-[4.25rem] max-h-[5.5rem] flex-col justify-center gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--ds-accent)_12%,transparent)] text-[var(--ds-accent)] dark:bg-sky-500/15 dark:text-sky-300"
          aria-hidden
        >
          <CalendarDays className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <h1 className="font-headline text-xl font-bold tracking-tight text-ds-foreground sm:text-[1.35rem]">Schedule</h1>
          <p className="truncate text-xs leading-snug text-ds-muted sm:text-[13px]">
            Manage staffing, coverage, and availability
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div>
    </header>
  );
}
