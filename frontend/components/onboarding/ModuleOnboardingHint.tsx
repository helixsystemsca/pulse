"use client";

import type { ReactNode } from "react";

export function ModuleOnboardingHint({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-md border border-sky-200/90 bg-sky-50/90 px-4 py-3 text-sm leading-relaxed text-pulse-navy dark:border-sky-500/35 dark:bg-sky-500/10 dark:text-slate-100 ${className}`}
      role="note"
    >
      {children}
    </div>
  );
}
