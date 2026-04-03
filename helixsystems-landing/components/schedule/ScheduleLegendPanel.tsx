"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";
import type { Shift, ShiftTypeConfig, Worker } from "@/lib/schedule/types";

/** Stable pseudo-color from string (for worker / project rows). */
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

type Props = {
  shiftTypes: ShiftTypeConfig[];
  workers: Worker[];
  shifts: Shift[];
  contentFilter: "workers" | "projects" | "combined";
};

export function ScheduleLegendPanel({ shiftTypes, workers, shifts, contentFilter }: Props) {
  const [open, setOpen] = useState(true);

  const projects = useMemo(() => {
    const names = new Set<string>();
    for (const s of shifts) {
      if (s.shiftKind === "project_task" && s.projectName?.trim()) names.add(s.projectName.trim());
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [shifts]);

  const activeWorkers = useMemo(
    () => workers.filter((w) => w.active).sort((a, b) => a.name.localeCompare(b.name)),
    [workers],
  );

  return (
    <aside
      className="rounded-2xl border border-slate-200/90 bg-white shadow-sm lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto"
      aria-label="Schedule legend"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 text-left lg:cursor-default lg:border-0"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-pulse-navy">Legend</span>
        <span className="text-pulse-muted lg:hidden">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      <div className={`space-y-5 px-4 pb-4 pt-2 ${open ? "" : "hidden lg:block"}`}>
        <section>
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-pulse-muted">Shift types</h3>
          <ul className="mt-2 space-y-2">
            {shiftTypes.map((t) => (
              <li key={t.key} className="flex items-center gap-2 text-xs text-pulse-navy">
                <span className={`h-3 w-3 shrink-0 rounded-sm border ${t.bg} ${t.border}`} aria-hidden />
                <span className="font-medium capitalize">{t.label}</span>
              </li>
            ))}
          </ul>
        </section>

        {(contentFilter === "workers" || contentFilter === "combined") && activeWorkers.length > 0 ? (
          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-pulse-muted">Workers</h3>
            <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto pr-1">
              {activeWorkers.map((w) => {
                const c = colorFromKey(w.id);
                return (
                  <li key={w.id} className="flex items-center gap-2 text-xs text-pulse-navy">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full border"
                      style={{ backgroundColor: c.bg, borderColor: c.border }}
                      aria-hidden
                    />
                    <span className="truncate">{w.name}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {(contentFilter === "projects" || contentFilter === "combined") && projects.length > 0 ? (
          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-pulse-muted">Projects</h3>
            <ul className="mt-2 max-h-36 space-y-1.5 overflow-y-auto pr-1">
              {projects.map((p) => {
                const c = colorFromKey(p);
                return (
                  <li key={p} className="flex items-center gap-2 text-xs text-pulse-navy">
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
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-pulse-muted">Status</h3>
          <ul className="mt-2 space-y-1.5 text-[11px] text-pulse-muted">
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" aria-hidden />
              Conflict / critical
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-hidden />
              Warning
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-flex rounded border border-dashed border-pulse-accent/50 px-1 text-[9px] font-bold text-pulse-accent">
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
