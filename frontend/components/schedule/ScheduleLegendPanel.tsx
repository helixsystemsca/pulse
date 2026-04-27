"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";
import {
  recurringWindowLegendFromWorkers,
  shiftCodesLegendBlurb,
} from "@/lib/schedule/shift-codes";
import type { Shift, ShiftTypeConfig, Worker } from "@/lib/schedule/types";

/** Stable pseudo-color from string (fallback when no project id tint). */
function colorFromKey(key: string): { bg: string; border: string } {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const hues = [200, 220, 260, 30, 145, 330, 185];
  const hue = hues[h % hues.length];
  return {
    bg: `hsla(${hue}, 55%, 88%, 0.95)`,
    border: `hsla(${hue}, 45%, 55%, 0.85)`,
  };
}

export type ScheduleProjectLegendItem = {
  id: string;
  name: string;
  /** Tailwind classes for the legend swatch (same as month/week top bar). */
  tintClass: string;
};

type Props = {
  shiftTypes: ShiftTypeConfig[];
  shifts: Shift[];
  workers: Worker[];
  shiftDefinitions?: { id: string; code: string; name?: string | null }[];
  contentFilter: "workers" | "projects" | "combined";
  /** When set, lists projects (e.g. from the Projects page) with schedule overlay colors. */
  projectLegendItems: ScheduleProjectLegendItem[] | null;
};

export function ScheduleLegendPanel({ shiftTypes, shifts, workers, shiftDefinitions, contentFilter, projectLegendItems }: Props) {
  const [open, setOpen] = useState(true);

  const recurringWindows = useMemo(() => recurringWindowLegendFromWorkers(workers), [workers]);

  const projectsFromShifts = useMemo(() => {
    const names = new Set<string>();
    for (const s of shifts) {
      if (s.shiftKind === "project_task" && s.projectName?.trim()) names.add(s.projectName.trim());
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [shifts]);

  return (
    <aside
      className="rounded-md border border-pulseShell-border bg-pulseShell-surface shadow-[var(--pulse-shell-shadow)] lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto"
      aria-label="Schedule legend"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 border-b border-pulseShell-border px-4 py-3 text-left lg:cursor-default lg:border-0"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-gray-900 dark:text-white">Legend</span>
        <span className="text-gray-500 dark:text-gray-400 lg:hidden">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      <div className={`space-y-5 px-4 pb-4 pt-2 ${open ? "" : "hidden lg:block"}`}>
        {shiftDefinitions && shiftDefinitions.length > 0 ? (
          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Shift definitions
            </h3>
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Shift definitions">
              {shiftDefinitions.map((d) => (
                <li key={d.id}>
                  <span
                    className="inline-flex items-center rounded-md border border-pulseShell-border bg-pulseShell-elevated px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums text-gray-900 dark:text-gray-100"
                    title={d.name ?? d.code}
                  >
                    {d.code}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <section>
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Shift codes</h3>
          <ul className="mt-2 space-y-1.5 text-[11px] leading-snug text-gray-600 dark:text-gray-300">
            {shiftCodesLegendBlurb().map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {recurringWindows.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Recurring shift windows from worker profiles">
              {recurringWindows.map((r) => (
                <li key={r.code}>
                  <span className="inline-flex items-center rounded-md border border-pulseShell-border bg-pulseShell-elevated px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums text-gray-900 dark:text-gray-100">
                    {r.code}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
              Add recurring hours in worker profiles to list standard shift codes (D1, A1, …) here.
            </p>
          )}
        </section>

        <section>
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Shift types</h3>
          <ul className="mt-2 space-y-2">
            {shiftTypes.map((t) => (
              <li key={t.key} className="flex items-center gap-2 text-xs text-gray-900 dark:text-gray-100">
                <span className={`h-3 w-3 shrink-0 rounded-sm border ${t.bg} ${t.border}`} aria-hidden />
                <span className="font-medium capitalize">{t.label}</span>
              </li>
            ))}
          </ul>
        </section>

        {(contentFilter === "projects" || contentFilter === "combined") &&
        projectLegendItems &&
        projectLegendItems.length > 0 ? (
          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Projects</h3>
            <ul className="mt-2 max-h-36 space-y-1.5 overflow-y-auto pr-1">
              {projectLegendItems.map((p) => (
                <li key={p.id} className="flex min-w-0 items-center gap-2 text-xs text-gray-900 dark:text-gray-100">
                  <span
                    className={`h-3 w-3 shrink-0 rounded-sm border border-black/10 dark:border-white/10 ${p.tintClass}`}
                    aria-hidden
                  />
                  <span className="truncate" title={p.name}>
                    {p.name}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : (contentFilter === "projects" || contentFilter === "combined") && projectsFromShifts.length > 0 ? (
          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Projects</h3>
            <ul className="mt-2 max-h-36 space-y-1.5 overflow-y-auto pr-1">
              {projectsFromShifts.map((p) => {
                const c = colorFromKey(p);
                return (
                  <li key={p} className="flex min-w-0 items-center gap-2 text-xs text-gray-900 dark:text-gray-100">
                    <span
                      className="h-3 w-3 shrink-0 rounded-sm border"
                      style={{ backgroundColor: c.bg, borderColor: c.border }}
                      aria-hidden
                    />
                    <span className="truncate">{p}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <section>
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Status</h3>
          <ul className="mt-2 space-y-1.5 text-[11px] text-gray-500 dark:text-gray-400">
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" aria-hidden />
              Conflict / critical
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-hidden />
              Warning
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-flex rounded border border-dashed border-blue-500/50 px-1 text-[9px] font-bold text-blue-600 dark:border-blue-400/45 dark:text-blue-400">
                Open
              </span>
              Unassigned shift
            </li>
          </ul>
        </section>
      </div>
    </aside>
  );
}
