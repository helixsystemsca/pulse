"use client";

import { ShieldCheck, ShieldOff } from "lucide-react";

import type { WorkforceSiteCertCoverage } from "@/lib/dashboard/workforce-site-certs";
import type { WidgetHeightTier } from "@/lib/dashboard/workspace-layout";
import { opsWidgetFillLayout } from "@/lib/dashboard/ops-widget-fill";
import { cn } from "@/lib/cn";

export function WorkforceSiteCertifications({
  items,
  heightTier = "expanded",
}: {
  items: WorkforceSiteCertCoverage[];
  heightTier?: WidgetHeightTier;
}) {
  const fillRows = opsWidgetFillLayout(heightTier);

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col border-t border-[color-mix(in_srgb,var(--ds-text-primary)_10%,transparent)] pt-2",
        fillRows && "flex-1",
      )}
    >
      <p className="shrink-0 text-[10px] font-bold uppercase tracking-[0.1em] text-[color-mix(in_srgb,var(--ds-text-primary)_48%,transparent)]">
        Certifications on site
      </p>
      <ul
        className={cn(
          "mt-1.5 flex min-h-0 flex-col",
          fillRows ? "flex-1 justify-between gap-2" : "gap-1.5",
        )}
      >
        {items.map((row) => {
          const covered = row.status === "covered";
          return (
            <li
              key={row.id}
              className={cn(
                "flex min-h-0 items-center justify-between gap-2 rounded-lg px-2.5",
                fillRows ? "flex-1 py-2.5" : "py-2",
                covered
                  ? "bg-[color-mix(in_srgb,var(--ds-success)_12%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--ds-success)_22%,transparent)]"
                  : "bg-[color-mix(in_srgb,var(--ds-danger)_10%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--ds-danger)_20%,transparent)]",
              )}
              title={
                covered && row.holderNames.length > 0
                  ? `On site: ${row.holderNames.join(", ")}`
                  : covered
                    ? "Covered by staff on site"
                    : "No one on site holds this certification"
              }
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {covered ? (
                  <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                ) : (
                  <ShieldOff className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden />
                )}
                <span
                  className={cn(
                    "min-w-0 truncate font-semibold text-[color-mix(in_srgb,var(--ds-text-primary)_92%,transparent)]",
                    fillRows ? "text-sm" : "text-xs",
                  )}
                >
                  {row.label}
                </span>
              </div>
              <span
                className={cn(
                  "shrink-0 text-[10px] font-bold uppercase tracking-wide",
                  covered ? "text-emerald-800 dark:text-emerald-200" : "text-rose-800 dark:text-rose-200",
                )}
              >
                {covered ? "On site" : "Missing"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
