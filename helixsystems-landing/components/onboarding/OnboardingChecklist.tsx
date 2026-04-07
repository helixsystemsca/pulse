"use client";

import { Check, ChevronDown, ChevronUp, ListChecks } from "lucide-react";
import Link from "next/link";
import { ONBOARDING_STEP_HREF } from "@/lib/onboardingService";
import { useOnboarding } from "./OnboardingProvider";

export function OnboardingChecklist() {
  const { state, loading, active, checklistExpanded, setChecklistExpanded } = useOnboarding();

  if (loading || !active || !state) return null;

  const { steps, completed_count, total_count } = state;
  const pct = total_count ? Math.round((completed_count / total_count) * 100) : 0;

  return (
    <div
      className={`pointer-events-auto fixed bottom-4 right-4 z-[115] flex max-w-[min(100vw-2rem,22rem)] flex-col rounded-md border border-slate-200/90 bg-white shadow-xl backdrop-blur-sm transition-all duration-200 dark:border-slate-600 dark:bg-slate-900 ${
        checklistExpanded ? "max-h-[min(72vh,32rem)]" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => setChecklistExpanded(!checklistExpanded)}
        className="flex w-full items-center gap-3 rounded-t-md px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/80"
        aria-expanded={checklistExpanded}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-[#2B4C7E] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
          <ListChecks className="h-4 w-4" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-pulse-navy dark:text-slate-100">Setup checklist</p>
          <p className="text-xs text-pulse-muted dark:text-slate-400">
            {completed_count} / {total_count} required
            <span className="text-pulse-muted dark:text-slate-500"> · </span>
            {pct}%
          </p>
        </div>
        <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div
            className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        {checklistExpanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-pulse-muted dark:text-slate-400" />
        ) : (
          <ChevronUp className="h-4 w-4 shrink-0 text-pulse-muted dark:text-slate-400" />
        )}
      </button>

      {checklistExpanded ? (
        <ul className="max-h-[min(56vh,24rem)] space-y-1 overflow-y-auto border-t border-slate-200 px-2 py-2 dark:border-slate-600">
          {steps.map((s) => {
            const href = s.href?.trim() || (ONBOARDING_STEP_HREF[s.key] ?? "/overview");
            return (
              <li key={s.key}>
                <Link
                  href={href}
                  className={`flex items-start gap-2 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/80 ${
                    s.completed ? "text-pulse-muted dark:text-slate-400" : "text-pulse-navy dark:text-slate-100"
                  }`}
                  onClick={() => setChecklistExpanded(false)}
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                      s.completed
                        ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500/45 dark:bg-emerald-950/55 dark:text-emerald-300"
                        : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900"
                    }`}
                    aria-hidden
                  >
                    {s.completed ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">
                      {s.label}
                      {s.optional ? (
                        <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                          Optional
                        </span>
                      ) : null}
                    </span>
                    {s.description ? (
                      <span className="mt-0.5 block text-xs leading-snug text-pulse-muted dark:text-slate-400">
                        {s.description}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
