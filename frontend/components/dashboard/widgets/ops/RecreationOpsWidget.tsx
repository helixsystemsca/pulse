"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckSquare, HelpCircle, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/cn";
import { fetchCommandDashboard, type OpsCommandDashboard } from "@/lib/recreation/commandService";

function Metric({
  label,
  value,
  href,
  warn,
}: {
  label: string;
  value: number;
  href: string;
  warn: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-w-0 flex-1 flex-col rounded-lg px-2 py-1.5",
        warn
          ? "bg-[color-mix(in_srgb,var(--ds-warning)_12%,transparent)]"
          : "bg-[color-mix(in_srgb,var(--ds-text-primary)_4%,transparent)]",
      )}
    >
      <span className="text-[10px] font-bold uppercase tracking-wide text-[color-mix(in_srgb,var(--ds-text-primary)_56%,transparent)]">
        {label}
      </span>
      <span className="text-lg font-semibold tabular-nums text-[color-mix(in_srgb,var(--ds-text-primary)_92%,transparent)]">
        {value}
      </span>
    </Link>
  );
}

export function RecreationOpsWidget() {
  const [dash, setDash] = useState<OpsCommandDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchCommandDashboard()
      .then((d) => {
        if (!cancelled) setDash(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <p className="px-1 text-xs text-[color-mix(in_srgb,var(--ds-text-primary)_56%,transparent)]">{error}</p>;
  }
  if (!dash) {
    return <p className="px-1 text-xs text-[color-mix(in_srgb,var(--ds-text-primary)_56%,transparent)]">Loading…</p>;
  }

  const due = dash.due_items.slice(0, 5);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <div className="ops-dash-inner-card flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        <div className="flex shrink-0 gap-1.5">
          <Metric
            label="Overdue"
            value={dash.checklist_overdue}
            href="/recreation/checklists"
            warn={dash.checklist_overdue > 0}
          />
          <Metric
            label="Due today"
            value={dash.checklist_due_today}
            href="/recreation/checklists"
            warn={dash.checklist_due_today > 0}
          />
          <Metric
            label="Gaps"
            value={dash.knowledge_gaps_open}
            href="/recreation/knowledge-gaps"
            warn={dash.knowledge_gaps_high > 0}
          />
        </div>

        <div className="flex shrink-0 gap-1.5 text-[11px]">
          <Link
            href="/recreation/team-development"
            className="inline-flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-2 py-1.5 bg-[color-mix(in_srgb,var(--ds-text-primary)_4%,transparent)]"
          >
            <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-[var(--ds-warning)]" aria-hidden />
            <span className="truncate">{dash.open_team_risks ?? 0} team risks</span>
          </Link>
          <Link
            href="/recreation/me"
            className="inline-flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-2 py-1.5 bg-[color-mix(in_srgb,var(--ds-text-primary)_4%,transparent)]"
          >
            <HelpCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              {dash.authority_unknown > 0 ? `${dash.authority_unknown} to confirm` : "Authority current"}
            </span>
          </Link>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--ds-accent)]">Today</p>
          {due.length ? (
            <ul className="space-y-1">
              {due.map((item, idx) => (
                <li key={idx}>
                  <Link
                    href={String(item.href || "/recreation/checklists")}
                    className="block rounded-md px-1.5 py-1 hover:bg-[color-mix(in_srgb,var(--ds-text-primary)_5%,transparent)]"
                  >
                    <span className="line-clamp-2 text-[11px] font-medium text-[color-mix(in_srgb,var(--ds-text-primary)_90%,transparent)]">
                      {String(item.title)}
                    </span>
                    <span className="text-[10px] text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]">
                      {String(item.kind)}
                      {item.due_date ? ` · ${String(item.due_date)}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : dash.active_checklist_summaries.length ? (
            <ul className="space-y-1.5">
              {dash.active_checklist_summaries.slice(0, 3).map((c) => (
                <li key={c.id}>
                  <Link href={`/recreation/checklists?id=${c.id}`} className="block px-1.5">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="inline-flex min-w-0 items-center gap-1 truncate font-medium">
                        <CheckSquare className="h-3 w-3 shrink-0" aria-hidden />
                        {c.title}
                      </span>
                      <span className="shrink-0 tabular-nums text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]">
                        {c.progress_pct}%
                      </span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--ds-text-primary)_10%,transparent)]">
                      <div className="h-full rounded-full bg-[var(--ds-accent)]" style={{ width: `${c.progress_pct}%` }} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-1.5 text-[11px] text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]">
              Nothing due. Open checklists or knowledge gaps from Recreation Ops.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
