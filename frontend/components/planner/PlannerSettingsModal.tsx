"use client";

import { useEffect, useState } from "react";
import type { PlannerCategory, PlannerSettings } from "@/lib/planner/plannerService";
import { hhmm } from "@/lib/planner/plannerService";

const inputClass =
  "w-full rounded-lg border border-ds-border bg-ds-bg px-3 py-2 text-sm text-ds-foreground outline-none focus:border-ds-primary";
const btnPrimary =
  "rounded-lg bg-ds-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50";
const btnGhost = "rounded-lg border border-ds-border px-3 py-1.5 text-sm text-ds-foreground hover:bg-ds-card";

export function PlannerSettingsModal({
  open,
  settings,
  categories,
  busy,
  onClose,
  onSaveHours,
  onSaveColor,
}: {
  open: boolean;
  settings: PlannerSettings | null;
  categories: PlannerCategory[];
  busy?: boolean;
  onClose: () => void;
  onSaveHours: (workStart: string, workEnd: string) => Promise<void> | void;
  onSaveColor: (categoryId: string, color: string) => Promise<void> | void;
}) {
  const [workStart, setWorkStart] = useState("08:30");
  const [workEnd, setWorkEnd] = useState("16:30");

  useEffect(() => {
    if (!open || !settings) return;
    setWorkStart(hhmm(settings.work_start) || "08:30");
    setWorkEnd(hhmm(settings.work_end) || "16:30");
  }, [open, settings]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[min(92dvh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-ds-border bg-ds-card shadow-xl">
        <div className="border-b border-ds-border px-4 py-3">
          <h3 className="text-lg font-semibold">Planner settings</h3>
          <p className="mt-1 text-sm text-ds-muted">
            Working hours seed the 1-hour template. Category colors tint every block on the day calendar.
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">Working hours</p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <label>
              <span className="mb-1 block text-xs text-ds-muted">Start</span>
              <input className={inputClass} type="time" step={900} value={workStart} onChange={(e) => setWorkStart(e.target.value)} />
            </label>
            <label>
              <span className="mb-1 block text-xs text-ds-muted">End</span>
              <input className={inputClass} type="time" step={900} value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} />
            </label>
          </div>
          <button
            type="button"
            className={`${btnPrimary} mt-3`}
            disabled={busy}
            onClick={() => void onSaveHours(workStart, workEnd)}
          >
            Save hours
          </button>

          <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-ds-muted">Category colors</p>
          <ul className="mt-2 space-y-2">
            {categories.map((cat) => (
              <li key={cat.id} className="flex items-center justify-between gap-3 rounded-lg border border-ds-border px-3 py-2">
                <span className="text-sm font-medium" style={{ color: cat.color }}>
                  {cat.name}
                </span>
                <input
                  type="color"
                  value={cat.color}
                  aria-label={`${cat.name} color`}
                  disabled={busy}
                  onChange={(e) => void onSaveColor(cat.id, e.target.value)}
                  className="h-8 w-12 cursor-pointer rounded border border-ds-border bg-transparent"
                />
              </li>
            ))}
          </ul>
        </div>
        <div className="flex justify-end border-t border-ds-border px-4 py-3">
          <button type="button" className={btnGhost} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
