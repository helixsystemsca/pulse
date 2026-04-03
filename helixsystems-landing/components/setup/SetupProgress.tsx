"use client";

import { AlertTriangle, Check, Circle } from "lucide-react";

export function SetupProgress({
  items,
  warnings = [],
}: {
  items: { id: string; label: string; done: boolean }[];
  /** Site checks that do not map 1:1 to checklist ticks (misconfiguration hints). */
  warnings?: { id: string; text: string; action?: { label: string; onClick: () => void } }[];
}) {
  const missing = items.filter((i) => !i.done).map((i) => i.label);
  const pct = items.length === 0 ? 0 : Math.round((items.filter((i) => i.done).length / items.length) * 100);

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-card md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-pulse-navy">Setup progress</h2>
          <p className="mt-0.5 text-sm text-pulse-muted">Track what is left before go-live.</p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold tabular-nums text-[#2B4C7E]">{pct}%</span>
          <span className="ml-1 text-xs text-pulse-muted">complete</span>
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      {warnings.length > 0 ? (
        <div className="mt-4 rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-950">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            Setup checks
          </p>
          <ul className="mt-2 space-y-2 text-sm text-amber-950/95">
            {warnings.map((w) => (
              <li
                key={w.id}
                className="flex flex-col gap-2 rounded-lg bg-white/60 px-3 py-2.5 ring-1 ring-amber-200/50 sm:flex-row sm:items-center sm:justify-between"
              >
                <span>{w.text}</span>
                {w.action ? (
                  <button
                    type="button"
                    onClick={w.action.onClick}
                    className="shrink-0 rounded-lg bg-amber-800/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-900"
                  >
                    {w.action.label}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <ul className="mt-5 grid gap-2 sm:grid-cols-2">
        {items.map((row) => (
          <li
            key={row.id}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ring-1 ${
              row.done
                ? "bg-emerald-50/90 text-emerald-950 ring-emerald-200/70"
                : "bg-slate-50/90 text-pulse-navy ring-slate-200/70"
            }`}
          >
            {row.done ? (
              <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <Circle className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            )}
            <span className={row.done ? "font-medium" : ""}>{row.label}</span>
          </li>
        ))}
      </ul>
      {missing.length > 0 ? (
        <div className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
          <span className="font-semibold">Still needed: </span>
          {missing.join("; ")}.
        </div>
      ) : (
        <p className="mt-4 text-sm font-medium text-emerald-800">All setup steps look complete.</p>
      )}
    </section>
  );
}
