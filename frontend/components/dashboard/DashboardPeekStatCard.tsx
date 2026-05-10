"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { DASH } from "@/styles/dashboardTheme";

export type DashboardPeekStatTone = "neutral" | "ocean" | "iris" | "emerald" | "amber" | "rose";

const TONE_RING: Record<DashboardPeekStatTone, string> = {
  neutral: "border-[color-mix(in_srgb,var(--ds-text-primary)_10%,transparent)]",
  ocean: "border-[color-mix(in_srgb,var(--ds-accent)_28%,transparent)]",
  iris: "border-[color-mix(in_srgb,rgb(129_140_248)_35%,transparent)]",
  emerald: "border-[color-mix(in_srgb,var(--ds-success)_30%,transparent)]",
  amber: "border-[color-mix(in_srgb,var(--ds-warning)_32%,transparent)]",
  rose: "border-[color-mix(in_srgb,var(--ds-danger)_28%,transparent)]",
};

/**
 * Compact KPI card for dashboard “peek” slices — uppercase label, primary content, muted footer.
 * Matches the light elevated tile pattern used on the Operations dashboard.
 */
export function DashboardPeekStatCard({
  label,
  children,
  footer,
  tone = "neutral",
  className,
}: {
  label: string;
  children: ReactNode;
  footer?: ReactNode;
  tone?: DashboardPeekStatTone;
  className?: string;
}) {
  return (
    <div
      className={cn(
        DASH.peekStatCard,
        TONE_RING[tone],
        className,
      )}
    >
      <p className={DASH.peekStatLabel}>{label}</p>
      <div className="mt-2.5 min-w-0">{children}</div>
      {footer != null && footer !== false ? (
        <p className="mt-3 text-[11px] leading-snug text-[color-mix(in_srgb,var(--ds-text-primary)_48%,transparent)]">{footer}</p>
      ) : null}
    </div>
  );
}
