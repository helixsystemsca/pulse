"use client";

import type { WorkforceSiteCertCoverage } from "@/lib/dashboard/workforce-site-certs";
import { cn } from "@/lib/cn";

function certIndicatorTitle(row: WorkforceSiteCertCoverage): string {
  const covered = row.status === "covered";
  if (covered && row.holderNames.length > 0) {
    return `${row.label}: on site (${row.holderNames.join(", ")})`;
  }
  if (covered) return `${row.label}: on site`;
  return `${row.label}: missing on site`;
}

export function WorkforceSiteCertifications({
  items,
}: {
  items: WorkforceSiteCertCoverage[];
  /** @deprecated Height tier no longer affects cert strip layout. */
  heightTier?: string;
}) {
  return (
    <div className="shrink-0 border-t border-[color-mix(in_srgb,var(--ds-text-primary)_10%,transparent)] pt-2">
      <p className="shrink-0 text-[10px] font-bold uppercase tracking-[0.1em] text-[color-mix(in_srgb,var(--ds-text-primary)_48%,transparent)]">
        Certifications on site
      </p>
      <div
        className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md bg-[color-mix(in_srgb,var(--ds-text-primary)_4%,transparent)] px-2 py-1.5"
        role="list"
        aria-label="Certifications on site"
      >
        {items.map((row) => {
          const covered = row.status === "covered";
          return (
            <span
              key={row.id}
              role="listitem"
              className="inline-flex min-w-0 max-w-full items-center gap-1.5"
              title={certIndicatorTitle(row)}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  covered
                    ? "bg-emerald-500 shadow-[0_0_0_2px_color-mix(in_srgb,var(--ds-success)_28%,transparent)]"
                    : "bg-rose-500 shadow-[0_0_0_2px_color-mix(in_srgb,var(--ds-danger)_22%,transparent)]",
                )}
                aria-hidden
              />
              <span className="truncate text-[10px] font-medium leading-tight text-[color-mix(in_srgb,var(--ds-text-primary)_88%,transparent)]">
                {row.label}
              </span>
              <span className="sr-only">{covered ? "on site" : "missing"}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
