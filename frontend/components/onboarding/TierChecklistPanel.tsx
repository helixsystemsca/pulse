"use client";

import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { useOnboarding } from "./OnboardingProvider";

export function TierChecklistPanel() {
  const { state } = useOnboarding();
  const [open, setOpen] = useState(false);
  if (!state?.onboarding_enabled || !state?.tier1_modules?.length) return null;

  const pct = state.tier1_total_count
    ? Math.round((state.tier1_completed_count / state.tier1_total_count) * 100)
    : 0;

  return (
    <aside className="pointer-events-auto fixed bottom-4 left-4 z-[114] w-[min(94vw,24rem)] rounded-xl border border-ds-border bg-ds-primary shadow-[var(--ds-shadow-card)]">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-ds-secondary/60"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ds-foreground">Tier 1 module checklist</p>
          <p className="text-xs text-ds-muted">
            {state.tier1_completed_count} / {state.tier1_total_count} actions complete ({pct}%)
          </p>
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-ds-muted" /> : <ChevronUp className="h-4 w-4 text-ds-muted" />}
      </button>
      {open ? (
        <div className="max-h-[58vh] space-y-3 overflow-y-auto border-t border-ds-border px-4 py-3">
          {state.tier1_modules.map((module) => (
            <section key={module.module} className="rounded-lg border border-ds-border bg-ds-secondary/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-ds-foreground">{module.title}</h4>
                <span className="text-[11px] font-semibold text-ds-muted">
                  {module.completed_count}/{module.total_count}
                </span>
              </div>
              <ul className="mt-2 space-y-1">
                {module.items.map((item) => (
                  <li key={item.key}>
                    <Link
                      href={item.href || "/overview"}
                      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ${
                        item.completed ? "text-ds-muted" : "text-ds-foreground hover:bg-ds-interactive-hover"
                      }`}
                    >
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          item.completed ? "bg-[#36F1CD]" : "bg-slate-300 dark:bg-slate-600"
                        }`}
                      />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
    </aside>
  );
}

