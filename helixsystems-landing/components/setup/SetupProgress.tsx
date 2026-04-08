"use client";

import { AlertTriangle, Check, Circle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Phase = "show" | "pulse" | "exit" | "gone";

const PULSE_MS = 980;
const EXIT_MS = 560;

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

  const allChecklistDone = items.length > 0 && items.every((i) => i.done);
  const shouldCelebrate = allChecklistDone && warnings.length === 0;

  const [phase, setPhase] = useState<Phase>("show");
  const prevShouldCelebrateRef = useRef<boolean | null>(null);

  useEffect(() => {
    // Only run the celebration animation when we *transition* into a fully-complete, no-warnings state.
    // If the page loads already complete, keep the card visible (no pulse/exit loop on every load).
    const prev = prevShouldCelebrateRef.current;
    prevShouldCelebrateRef.current = shouldCelebrate;

    if (!shouldCelebrate) {
      setPhase("show");
      return;
    }
    if (prev === null) {
      // First render and already complete: don't animate.
      setPhase("show");
      return;
    }
    if (prev === true) {
      // Still complete: don't re-run animation.
      setPhase("show");
      return;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      const t = window.setTimeout(() => setPhase("gone"), 450);
      return () => clearTimeout(t);
    }

    setPhase("pulse");
    const tExit = window.setTimeout(() => setPhase("exit"), PULSE_MS);
    const tGone = window.setTimeout(() => setPhase("gone"), PULSE_MS + EXIT_MS);
    return () => {
      clearTimeout(tExit);
      clearTimeout(tGone);
    };
  }, [shouldCelebrate]);

  if (phase === "gone") {
    return null;
  }

  const sectionClass =
    phase === "exit"
      ? "setup-progress-card-exit rounded-md border border-slate-200/80 bg-white/95 p-5 shadow-card dark:border-[#1F2937] dark:bg-[#111827] dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)] md:p-6"
      : "rounded-md border border-slate-200/80 bg-white/95 p-5 shadow-card dark:border-[#1F2937] dark:bg-[#111827] dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)] md:p-6";

  const pctClass =
    phase === "pulse"
      ? "setup-progress-pct-pulse text-2xl font-bold tabular-nums text-[#2B4C7E] dark:text-sky-400"
      : "text-2xl font-bold tabular-nums text-[#2B4C7E] dark:text-sky-400";

  return (
    <section className={sectionClass}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-pulse-navy dark:text-gray-100">Setup progress</h2>
          <p className="mt-0.5 text-sm text-pulse-muted dark:text-gray-400">Track what is left before go-live.</p>
        </div>
        <div className="text-right">
          <span className={pctClass}>{pct}%</span>
          <span className="ml-1 text-xs text-pulse-muted dark:text-gray-500">complete</span>
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-[#0F172A]">
        <div
          className="h-full rounded-full bg-emerald-500 dark:bg-emerald-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      {warnings.length > 0 ? (
        <div className="mt-4 rounded-md border border-amber-300/90 bg-amber-50/90 px-4 py-3 dark:border-amber-500/35 dark:bg-amber-950/60">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-950 dark:text-amber-100">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            Setup checks
          </p>
          <ul className="mt-2 space-y-2 text-sm text-amber-950/95 dark:text-amber-100/95">
            {warnings.map((w) => (
              <li
                key={w.id}
                className="flex flex-col gap-2 rounded-lg bg-white/60 px-3 py-2.5 ring-1 ring-amber-200/50 dark:bg-[#0F172A]/90 dark:ring-amber-500/25 sm:flex-row sm:items-center sm:justify-between"
              >
                <span>{w.text}</span>
                {w.action ? (
                  <button
                    type="button"
                    onClick={w.action.onClick}
                    className="shrink-0 rounded-lg bg-amber-800/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-900 dark:bg-amber-600 dark:hover:bg-amber-500"
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
            className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm ring-1 ${
              row.done
                ? "bg-emerald-50/90 text-emerald-950 ring-emerald-200/70 dark:bg-emerald-950/55 dark:text-emerald-100 dark:ring-emerald-500/35"
                : "bg-slate-50/90 text-pulse-navy ring-slate-200/70 dark:bg-[#0F172A] dark:text-gray-200 dark:ring-[#374151]"
            }`}
          >
            {row.done ? (
              <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            ) : (
              <Circle className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
            )}
            <span className={row.done ? "font-medium" : ""}>{row.label}</span>
          </li>
        ))}
      </ul>
      {missing.length > 0 ? (
        <div className="mt-4 rounded-md border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/50 dark:text-amber-50">
          <span className="font-semibold">Still needed: </span>
          {missing.join("; ")}.
        </div>
      ) : (
        <p className="mt-4 text-sm font-medium text-emerald-800 dark:text-emerald-300">All setup steps look complete.</p>
      )}
    </section>
  );
}
