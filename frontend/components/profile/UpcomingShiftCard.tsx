"use client";

import { CalendarClock } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/pulse/Card";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

export type UpcomingShiftRow = {
  id: string;
  dayLabel: string;
  dateLabel: string;
  facilityName: string;
  timeRange: string;
  shiftCode?: string | null;
  label?: string | null;
};

export function UpcomingShiftCard({
  shifts,
  loading,
}: {
  shifts: UpcomingShiftRow[];
  loading?: boolean;
}) {
  return (
    <Card
      padding="lg"
      variant="elevated"
      className="transition-[box-shadow] duration-200 hover:shadow-[var(--ds-shadow-card-hover)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-headline text-base font-extrabold text-ds-foreground">Upcoming shifts</p>
          <p className="mt-1 text-xs text-ds-muted">From your published Pulse schedule</p>
        </div>
        <Link
          href="/schedule"
          className={cn(buttonVariants({ surface: "light", intent: "accent" }), "rounded-xl px-4 py-2 text-xs font-bold")}
        >
          View schedule
        </Link>
      </div>

      <div className="mt-5 space-y-3">
        {loading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-ds-secondary/60" />
            ))}
          </div>
        ) : shifts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ds-border bg-ds-secondary/30 px-4 py-8 text-center text-sm text-ds-muted">
            No upcoming shifts in the next two weeks.
          </p>
        ) : (
          shifts.map((s) => (
            <div
              key={s.id}
              className={cn(
                "rounded-xl border border-ds-border/80 bg-[linear-gradient(120deg,color-mix(in_srgb,var(--ds-secondary)_55%,transparent)_0%,var(--ds-primary)_100%)]",
                "px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md dark:bg-[linear-gradient(120deg,#152032_0%,#131e2d_100%)]",
              )}
            >
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-ds-muted">
                <CalendarClock className="h-3.5 w-3.5 text-[#36F1CD]" aria-hidden />
                <span>{s.dayLabel}</span>
                <span className="text-ds-border">·</span>
                <span>{s.dateLabel}</span>
                {s.shiftCode ? (
                  <>
                    <span className="text-ds-border">·</span>
                    <span className="rounded-md bg-[#2B4C7E]/15 px-2 py-0.5 text-[10px] font-extrabold text-[#2B4C7E] dark:text-[#7ee8fb]">
                      {s.shiftCode}
                    </span>
                  </>
                ) : null}
              </div>
              <p className="mt-2 text-sm font-extrabold text-ds-foreground">{s.facilityName}</p>
              {s.label ? <p className="mt-0.5 text-xs font-semibold text-ds-muted">{s.label}</p> : null}
              <p className="mt-2 text-lg font-bold tabular-nums tracking-tight text-ds-foreground">{s.timeRange}</p>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
