"use client";

import { Zap } from "lucide-react";
import { Card } from "@/components/pulse/Card";
import type { XpLedgerRowDto } from "@/lib/gamificationService";

export function ActivityFeedCard({ rows, loading }: { rows: XpLedgerRowDto[]; loading?: boolean }) {
  return (
    <Card
      padding="lg"
      variant="primary"
      className="transition-[box-shadow] duration-200 hover:shadow-[var(--ds-shadow-card-hover)]"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#36F1CD]/15 text-[#0E7C66]">
          <Zap className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="font-headline text-base font-extrabold text-ds-foreground">Recent XP activity</p>
          <p className="mt-1 text-xs text-ds-muted">Recognition tied to completed work — same ledger as Team Insights.</p>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {loading ? (
          <li className="h-14 animate-pulse rounded-lg bg-ds-secondary/60" />
        ) : rows.length === 0 ? (
          <li className="rounded-lg border border-dashed border-ds-border px-4 py-6 text-center text-sm text-ds-muted">
            Complete tasks and work orders to earn XP — your momentum will show up here.
          </li>
        ) : (
          rows.slice(0, 8).map((r) => (
            <li key={r.id}>
              <div className="ds-card-primary flex items-start justify-between gap-3 rounded-lg px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ds-foreground">{r.reason || r.reasonCode}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ds-muted">{r.track}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-extrabold tabular-nums text-[#0E7C66] dark:text-[#36F1CD]">+{r.amount}</p>
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
