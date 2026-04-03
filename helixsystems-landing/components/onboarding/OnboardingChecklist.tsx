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
      className={`pointer-events-auto fixed bottom-4 right-4 z-[115] flex max-w-[min(100vw-2rem,20rem)] flex-col rounded-2xl border border-slate-200/90 bg-white/95 shadow-lg backdrop-blur-sm transition-all duration-200 ${
        checklistExpanded ? "max-h-[min(70vh,28rem)]" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => setChecklistExpanded(!checklistExpanded)}
        className="flex w-full items-center gap-3 rounded-t-2xl px-4 py-3 text-left hover:bg-slate-50/80"
        aria-expanded={checklistExpanded}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-[#2B4C7E]">
          <ListChecks className="h-4 w-4" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-pulse-navy">Setup checklist</p>
          <p className="text-xs text-pulse-muted">
            {completed_count} / {total_count} completed
            <span className="text-pulse-muted"> · </span>
            {pct}%
          </p>
        </div>
        <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        {checklistExpanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-pulse-muted" />
        ) : (
          <ChevronUp className="h-4 w-4 shrink-0 text-pulse-muted" />
        )}
      </button>

      {checklistExpanded ? (
        <ul className="max-h-[min(52vh,22rem)] space-y-0.5 overflow-y-auto border-t border-slate-100 px-2 py-2">
          {steps.map((s) => {
            const href = ONBOARDING_STEP_HREF[s.key] ?? "/overview";
            return (
              <li key={s.key}>
                <Link
                  href={href}
                  className={`flex items-start gap-2 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-slate-50 ${
                    s.completed ? "text-pulse-muted" : "text-pulse-navy"
                  }`}
                  onClick={() => setChecklistExpanded(false)}
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                      s.completed
                        ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                        : "border-slate-300 bg-white"
                    }`}
                    aria-hidden
                  >
                    {s.completed ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                  </span>
                  <span className={s.completed ? "line-through decoration-slate-300" : ""}>{s.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
