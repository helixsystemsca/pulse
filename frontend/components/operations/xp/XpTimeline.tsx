"use client";

import { Clock3 } from "lucide-react";
import { Card } from "@/components/pulse/Card";
import type { XpLedgerRowDto } from "@/lib/gamificationService";

export function XpTimeline({ rows, loading }: { rows: XpLedgerRowDto[]; loading?: boolean }) {
  return (
    <Card
      padding="lg"
      variant="primary"
      className="transition-[box-shadow] duration-200 hover:shadow-[var(--ds-shadow-card-hover)]"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ds-secondary text-ds-accent">
          <Clock3 className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="font-headline text-base font-extrabold text-ds-foreground">Activity timeline</p>
          <p className="mt-1 text-xs text-ds-muted">Structured recognition events — auditable and shift-fair.</p>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {loading ? (
          <li className="h-14 animate-pulse rounded-lg bg-ds-secondary/60" />
        ) : rows.length === 0 ? (
          <li className="rounded-lg border border-dashed border-ds-border px-4 py-6 text-center text-sm text-ds-muted">
            Completed work, training, and attendance will populate this feed.
          </li>
        ) : (
          rows.slice(0, 12).map((r) => (
            <li key={r.id}>
              <div className="ds-card-primary flex items-start justify-between gap-3 rounded-lg px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ds-foreground">{r.reason || r.reasonCode}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-ds-muted">
                    {r.category ? (
                      <span className="rounded-full bg-ds-secondary px-2 py-0.5 text-ds-foreground/90">{r.category}</span>
                    ) : null}
                    <span>{r.track}</span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={`text-sm font-extrabold tabular-nums ${
                      r.amount < 0 ? "text-rose-600 dark:text-rose-400" : "text-[#0E7C66] dark:text-[#36F1CD]"
                    }`}
                  >
                    {r.amount > 0 ? "+" : ""}
                    {r.amount}
                  </p>
                  <p className="text-[10px] font-semibold text-ds-muted">
                    {new Date(r.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
              </div>
            </li>
          ))
        )}
      </ul>
    </Card>
  );
}
