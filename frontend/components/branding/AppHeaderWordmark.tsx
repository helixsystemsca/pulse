"use client";

import type { CompanySummary } from "@/lib/pulse-session";
import { resolveAppHeaderWordmark } from "@/lib/branding/header-wordmark";
import { cn } from "@/lib/cn";

type Props = {
  company?: CompanySummary | null;
  className?: string;
};

/**
 * Top-bar tenant label — Poppins, same scale as legacy PANORAMA REC / Pulse chrome.
 */
export function AppHeaderWordmark({ company, className }: Props) {
  const label = resolveAppHeaderWordmark(company);
  return (
    <span
      className={cn(
        "font-panoramaBrand inline-flex min-w-0 max-w-[min(100%,14rem)] items-center whitespace-nowrap",
        "text-[clamp(1.05rem,2.1vw,1.45rem)] font-normal uppercase leading-none tracking-[0.04em] text-white",
        "truncate sm:max-w-[18rem]",
        className,
      )}
      title={label}
    >
      {label}
    </span>
  );
}
